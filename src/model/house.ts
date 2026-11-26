import raw from '../data/house.json'
import { createCollision } from './collision'
import { contains, rectangle, segments, type Floor, type Footprint, type Point, type Ring } from './geometry'

export interface Zone extends Floor {
  id: string
  key: string
  namePt: string
  label: Point
  areaComputed: number
  areaLabeled?: number | null
  indoor: boolean
  kind?: 'garden' | 'pool' | 'paving' | 'covered' | 'terrace'
  ceiling?: number
  depth?: number
}

interface Wall extends Footprint { id: string; base: number; height: number; kind: 'wall' | 'pillar' }
interface Opening {
  id: string
  kind: 'door' | 'window' | 'passage'
  axis: 'x' | 'y'
  rect: readonly [number, number, number, number]
  center: Point
  sill: number
  height: number
}

export const house = raw as unknown as {
  meta: typeof raw.meta
  lot: Footprint & { width: number; depth: number }
  rooms: Zone[]
  outdoor: Zone[]
  walls: Wall[]
  perimeterWalls: Omit<Wall, 'base'>[]
  openings: Opening[]
  roof: {
    eave: Ring
    area: number
    top: number
    slabThickness: number
    fasciaHeight: number
    dashedLines: { axis: 'x' | 'y'; at: number; start: number; end: number; dashes: number }[]
  }
}
export const zones = [...house.rooms, ...house.outdoor]
export const pool = house.outdoor.find(zone => zone.kind === 'pool')!
const p10 = house.openings.find(opening => opening.id === 'P10')!
export const p10FixedEnd = p10.rect[1] + 4
const obstacles = [
  ...house.walls, ...house.perimeterWalls, pool,
  ...house.openings.filter(opening => opening.kind === 'window').map(opening => ({ polygon: rectangle(opening.rect) })),
]
export const whiteCollision = createCollision(house.lot, obstacles)
export const collision = createCollision(house.lot, [
  ...obstacles,
  { polygon: rectangle([p10.rect[0], p10.rect[1], p10.rect[2], p10FixedEnd]) },
])

export function safePosition(point: Point, zone?: Zone, walkCollision = collision): Point | undefined {
  if (walkCollision.isFree(point) && (!zone || contains(zone, point))) return point
  for (let radius = 0.05; radius < 2; radius += 0.05) {
    for (let step = 0; step < 32; step++) {
      const angle = step * Math.PI / 16
      const candidate: Point = [point[0] + Math.cos(angle) * radius, point[1] + Math.sin(angle) * radius]
      if (walkCollision.isFree(candidate) && (!zone || contains(zone, candidate))) return candidate
    }
  }
}

export function zonePose(zone: Zone, walkCollision = collision) {
  const [x, y] = zone.label
  const position = zone.kind === 'pool'
    ? safePosition([Math.max(...zone.polygon.map(point => point[0])) + 0.48, y], undefined, walkCollision)!
    : safePosition(zone.label, zone, walkCollision) ?? safePosition(zone.label, undefined, walkCollision) ?? zone.label
  if (!zone.indoor && Math.hypot(x - position[0], y - position[1]) > 0.01) {
    return { position, heading: Math.atan2(y - position[1], x - position[0]) }
  }

  let areaTwice = 0
  let centroidX = 0
  let centroidY = 0
  for (const [[ax, ay], [bx, by]] of segments(zone.polygon)) {
    const cross = ax * by - bx * ay
    areaTwice += cross
    centroidX += (ax + bx) * cross
    centroidY += (ay + by) * cross
  }
  const inwardX = (areaTwice ? centroidX / (3 * areaTwice) : x) - position[0]
  const inwardY = (areaTwice ? centroidY / (3 * areaTwice) : y) - position[1]

  let heading = 0
  let reach = -1
  let bestAlignment = -Infinity
  const limit = zone.indoor ? 12 : 8
  for (let step = 0; step < 16; step++) {
    const angle = step * Math.PI / 8
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    let distance = 0
    while (distance < limit) {
      const next: Point = [position[0] + dx * (distance + 0.25), position[1] + dy * (distance + 0.25)]
      if (!walkCollision.isFree(next) || (!zone.indoor && !contains(zone, next))) break
      distance += 0.25
    }
    const alignment = zone.indoor ? dx * inwardX + dy * inwardY : 0
    if (distance < reach || (distance === reach && alignment <= bestAlignment)) continue
    reach = distance
    bestAlignment = alignment
    heading = angle
  }
  return { position, heading }
}

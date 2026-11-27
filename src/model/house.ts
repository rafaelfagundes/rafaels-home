import raw from '../data/house.json'
import { EYE_HEIGHT } from './person'
import { createOutdoorFeatures, planters, trees } from './landscape'
import { createCollision } from './collision'
import { furnitureColliders, vehicleColliders } from './furniture'
import type { Settings } from './settings'
import { contains, polygonArea, rectangle, segments, type Floor, type Footprint, type Point, type Ring } from './geometry'

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
export interface Opening {
  id: string
  kind: 'door' | 'window' | 'passage'
  operation?: 'sliding' | 'swing'
  description?: string
  axis: 'x' | 'y'
  rect: readonly [number, number, number, number]
  center: Point
  sill: number
  height: number
}

export const house = { ...raw, meta: { ...raw.meta, eyeHeight: EYE_HEIGHT } } as unknown as {
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
export const pool = house.outdoor.find(zone => zone.kind === 'pool')!
export const outdoorFeatures = createOutdoorFeatures(house.meta.levels.yard, pool)
const { deck, lounge, woodDeck, bench, firePit, steps, loungeApron, apronNotch } = outdoorFeatures
export const architecturalZones = [...house.rooms, ...house.outdoor].map(zone => {
  if (zone.key === 'side_path') return { ...zone, floor: zone.floor + 0.03 }
  if (zone.key !== 'garden') return zone
  // Cut the lounge and its apron out of the lawn along the terrace-side boundary.
  const polygon = zone.polygon.flatMap(point =>
    point[0] === apronNotch[0][0] && point[1] === apronNotch[2][1] ? apronNotch : [point])
  const garden = { ...zone, polygon }
  return { ...garden, areaComputed: polygonArea(garden) }
})
export const zones = [...architecturalZones, deck, woodDeck, lounge]
export const walkingFloors = [...steps, lounge, woodDeck, deck, ...loungeApron, ...architecturalZones]
export const plantExclusions = [
  ...loungeApron, ...zones.filter(zone => zone.kind !== 'garden'), ...house.walls, ...house.perimeterWalls, ...planters, ...trees,
]

const p10 = house.openings.find(opening => opening.id === 'P10')!
export const p10FixedEnd = p10.rect[1] + 4
const obstacles = [
  ...house.walls, ...house.perimeterWalls, pool, ...bench, firePit, ...planters, ...trees,
  ...house.openings.filter(opening => opening.kind === 'window').map(opening => ({ polygon: rectangle(opening.rect) })),
]
const finishedObstacles = [
  ...obstacles,
  { polygon: rectangle([p10.rect[0], p10.rect[1], p10.rect[2], p10FixedEnd]) },
]
const walkCollisions = new Map<number, ReturnType<typeof createCollision>>()

export function walkCollisionFor({ style, furniture, vehicles }: Pick<Settings, 'style' | 'furniture' | 'vehicles'>) {
  const key = (style === 'white' ? 4 : 0) + (furniture ? 2 : 0) + (vehicles ? 1 : 0)
  const cached = walkCollisions.get(key)
  if (cached) return cached
  const walkCollision = createCollision(house.lot, [
    ...(style === 'white' ? obstacles : finishedObstacles),
    ...(furniture ? furnitureColliders : []),
    ...(vehicles ? vehicleColliders : []),
  ])
  walkCollisions.set(key, walkCollision)
  return walkCollision
}

export const whiteCollision = walkCollisionFor({ style: 'white', furniture: false, vehicles: false })
export const collision = walkCollisionFor({ style: 'finished', furniture: false, vehicles: false })

export function safePosition(point: Point, from?: Zone | Point, walkCollision = collision): Point | undefined {
  if (from && !('polygon' in from)) {
    return walkCollision.move(from, [point[0] - from[0], point[1] - from[1]])
  }
  const zone = from
  if (walkCollision.isFree(point) && (!zone || contains(zone, point))) return point
  for (let radius = 0.05; radius < 2; radius += 0.05) {
    for (let step = 0; step < 32; step++) {
      const angle = step * Math.PI / 16
      const candidate: Point = [point[0] + Math.cos(angle) * radius, point[1] + Math.sin(angle) * radius]
      if (walkCollision.isFree(candidate) && (!zone || contains(zone, candidate))) return candidate
    }
  }
}

function centroid(polygon: Ring, fallback: Point): Point {
  let areaTwice = 0
  let centroidX = 0
  let centroidY = 0
  for (const [[ax, ay], [bx, by]] of segments(polygon)) {
    const cross = ax * by - bx * ay
    areaTwice += cross
    centroidX += (ax + bx) * cross
    centroidY += (ay + by) * cross
  }
  return areaTwice ? [centroidX / (3 * areaTwice), centroidY / (3 * areaTwice)] : fallback
}

const indoorCentroid: Point = (() => {
  let area = 0
  let x = 0
  let y = 0
  for (const room of house.rooms.filter(room => room.indoor)) {
    const weight = polygonArea(room)
    const [cx, cy] = centroid(room.polygon, room.label)
    area += weight
    x += cx * weight
    y += cy * weight
  }
  return [x / area, y / area]
})()

const houseFacingZones = new Set(['fire_lounge', 'pool_deck', 'pool', 'terrace', 'garden', 'wood_deck', 'veranda', 'gourmet'])

export function zonePose(zone: Zone, walkCollision = collision) {
  const [x, y] = zone.label
  const position = zone.kind === 'pool'
    ? safePosition([Math.max(...zone.polygon.map(point => point[0])) + 0.48, y], undefined, walkCollision)!
    : safePosition(zone.label, zone, walkCollision) ?? safePosition(zone.label, undefined, walkCollision) ?? zone.label
  if (houseFacingZones.has(zone.key)) {
    return { position, heading: Math.atan2(indoorCentroid[1] - position[1], indoorCentroid[0] - position[0]) }
  }
  if (!zone.indoor && Math.hypot(x - position[0], y - position[1]) > 0.01) {
    return { position, heading: Math.atan2(y - position[1], x - position[0]) }
  }

  const [cx, cy] = centroid(zone.polygon, zone.label)
  const inwardX = cx - position[0]
  const inwardY = cy - position[1]

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

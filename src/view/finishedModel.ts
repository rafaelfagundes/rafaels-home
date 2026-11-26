import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { floorAt, rectangle, segments, type Footprint, type Point, type Ring } from '../model/geometry'
import { architecturalZones, house, p10FixedEnd, type Zone } from '../model/house'
import { classifyWallFace, isStoneTileRoom, outwardNormals } from '../model/wallFinishes'
import { openingHeights, prismGeometry } from './model'
import type { PatternName } from './textures'

type Finish = PatternName | 'roofDeck' | 'blackMetal' | 'glazing'
type Part = 'floor' | 'wall' | 'ceiling' | 'eave'
interface Batch { part: Part; finish: Finish; geometry: THREE.BufferGeometry }
const batches = new Map<string, Omit<Batch, 'geometry'> & { pieces: THREE.BufferGeometry[] }>()

function add(part: Part, finish: Finish, geometry: THREE.BufferGeometry) {
  const key = part + ':' + finish
  const batch = batches.get(key) ?? { part, finish, pieces: [] }
  batch.pieces.push(geometry)
  batches.set(key, batch)
}

function prism(part: Part, finish: Finish, footprint: Footprint,
  bottom: number, top: number | ((x: number) => number), alongX = false) {
  const geometry = prismGeometry(footprint, bottom, top)
  const positions = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const y = positions.getZ(i)
    uv.setXY(i, alongX ? y : x, alongX ? x : y)
  }
  add(part, finish, geometry)
}

function wallFaces(wall: Footprint & { kind?: string }, low: number, high: number, perimeter = false) {
  for (const [index, ring] of [wall.polygon, ...(wall.holes ?? [])].entries()) {
    const normals = outwardNormals(ring, index > 0)
    for (const [i, [a, b]] of segments(ring).entries()) {
      const [nx, ny] = normals[i]
      const length = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (!length) continue
      const finish = perimeter ? 'boundary' : classifyWallFace(wall, a, b, normals[i], house.rooms)
      const indexed = new THREE.PlaneGeometry(length, high - low)
      const geometry = indexed.toNonIndexed()
      indexed.dispose()
      // Local right is tangent to the face, local +Z points outward.
      geometry.rotateY(Math.atan2(nx, ny))
      geometry.translate((a[0] + b[0]) / 2, (low + high) / 2, (a[1] + b[1]) / 2)
      const uv = geometry.getAttribute('uv')
      const origin = (a[0] + b[0]) / 2 * ny - (a[1] + b[1]) / 2 * nx - length / 2
      for (let vertex = 0; vertex < uv.count; vertex++) {
        uv.setXY(vertex, origin + uv.getX(vertex) * length, low + uv.getY(vertex) * (high - low))
      }
      add('wall', finish, geometry)
    }
  }
  // Keep dollhouse wall tops closed.
  surface('wall', perimeter ? 'boundary' : 'plaster', wall, high)
}

function surface(part: Part, finish: Finish, { polygon, holes = [] }: Footprint, height: number, underside = false) {
  const path = (ring: Ring) => ring.map(([x, y]) => new THREE.Vector2(x, underside ? y : -y))
  const shape = new THREE.Shape(path(polygon))
  shape.holes = holes.map(hole => new THREE.Path(path(hole)))
  const indexed = new THREE.ShapeGeometry(shape)
  const geometry = indexed.toNonIndexed()
  indexed.dispose()
  geometry.rotateX(underside ? Math.PI / 2 : -Math.PI / 2)
  geometry.translate(0, height, 0)
  const positions = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) uv.setXY(i, positions.getZ(i), positions.getX(i))
  add(part, finish, geometry)
}

function floorFinish(zone: Zone): PatternName {
  if (zone.kind === 'garden') return 'lawn'
  if (zone.key === 'side_path') return 'deck'
  if (zone.kind === 'paving') return 'darkPavers'
  if (zone.key === 'garage') return 'garage'
  if (!zone.indoor) return 'pavers'
  return isStoneTileRoom(zone.key) ? 'stoneTile' : 'concrete'
}

function bounds(ring: Ring) {
  const x = ring.map(point => point[0])
  const y = ring.map(point => point[1])
  return [Math.min(...x), Math.min(...y), Math.max(...x), Math.max(...y)] as const
}

function beams(part: 'ceiling' | 'eave', extent: readonly [number, number, number, number], height: number, alongX: boolean) {
  const [x0, y0, x1, y1] = extent
  const [start, end] = alongX ? [x0, x1] : [y0, y1]
  const count = Math.max(1, Math.round((end - start) / 1.8))
  for (let i = 0; i < count; i++) {
    const center = (start + end + (2 * i - count + 1) * 1.8) / 2
    const footprint = { polygon: rectangle(alongX
      ? [center - 0.09, y0, center + 0.09, y1]
      : [x0, center - 0.09, x1, center + 0.09]) }
    prism(part, 'beam', footprint, height - 0.13, height)
  }
}

for (const zone of architecturalZones) {
  if (zone.kind === 'pool') continue
  prism('floor', floorFinish(zone), zone, -0.035, x => floorAt(zone, x), zone.key === 'side_path')
  if (!zone.indoor || !zone.ceiling) continue
  const extent = bounds(zone.polygon)
  const [x0, y0, x1, y1] = extent
  const alongX = x1 - x0 > y1 - y0
  const ceiling = zone.floor + zone.ceiling
  prism('ceiling', 'ceilingWood', zone, ceiling, ceiling + 0.10, alongX)
  if (zone.key === 'hallway') beams('ceiling', extent, ceiling, alongX)
}

for (const wall of house.walls) wallFaces(wall, wall.base, wall.height)
for (const wall of house.perimeterWalls) wallFaces(wall, 0, house.meta.levels.yard + wall.height, true)

// Mullions share one box geometry, with the dimensions encoded per instance.
export const mullions: { position: [number, number, number]; scale: [number, number, number] }[] = []
for (const opening of house.openings) {
  const [x0, y0, x1, y1] = opening.rect
  const footprint = { polygon: rectangle(opening.rect) }
  const alongX = opening.axis === 'x'
  const [start, end] = alongX ? [x0, x1] : [y0, y1]
  const cross = alongX ? (y0 + y1) / 2 : (x0 + x1) / 2
  const floor = house.meta.levels.interior
  const fullHeight = opening.id === 'J01' || opening.id === 'P10'
  const bedroomHeight = opening.id === 'P07' || opening.id === 'P08'
  const { sill, head, top } = openingHeights(opening, fullHeight ? floor + 3 : bedroomHeight ? floor + 2.8 : undefined)
  if (top > head) wallFaces(footprint, head, top)
  if (opening.kind === 'window' && sill > 0) wallFaces(footprint, 0, sill)
  if (opening.kind !== 'window') prism('floor', 'concrete', footprint, -0.035, floor - 0.002)
  if (opening.kind === 'passage') continue

  const frame = 0.05
  function strip(from: number, to: number, depth: number) {
    return { polygon: rectangle(alongX
      ? [from, cross - depth / 2, to, cross + depth / 2]
      : [cross - depth / 2, from, cross + depth / 2, to]) }
  }
  const paneStart = start
  const paneEnd = opening.id === 'P10' ? p10FixedEnd : opening.id === 'P08' ? start + 0.65 : end
  const hasGlass = opening.kind === 'window' || opening.id === 'P10' || opening.id === 'P08'
  const frameBottom = opening.kind === 'window' ? sill : floor
  prism('wall', 'blackMetal', strip(start, end, frame), head - frame, head)
  for (const jamb of [start, end - frame]) {
    prism('wall', 'blackMetal', strip(jamb, jamb + frame, frame), frameBottom, head - frame)
  }
  if (!hasGlass) continue
  prism('wall', 'blackMetal', strip(paneStart, paneEnd, frame), frameBottom, frameBottom + frame)
  prism('wall', 'glazing', strip(paneStart + frame, paneEnd - frame / 2, 0.012), frameBottom + frame, head - frame)
  const count = Math.max(1, Math.round((paneEnd - paneStart) / 1.2))
  const last = paneEnd < end ? count : count - 1
  for (let i = 1; i <= last; i++) {
    const center = paneStart + (paneEnd - paneStart) * i / count - (i === count ? frame / 2 : 0)
    mullions.push({
      position: alongX ? [center, (frameBottom + head) / 2, cross] : [cross, (frameBottom + head) / 2, center],
      scale: [frame, head - frameBottom - 2 * frame, frame],
    })
  }
}

const { eave, top, slabThickness, fasciaHeight } = house.roof
const underside = top - slabThickness
export const whiteEave = prismGeometry({ polygon: eave }, underside, top)
export const whiteEaveLines = new THREE.EdgesGeometry(whiteEave, 24)
surface('eave', 'roofDeck', { polygon: eave }, top)
surface('eave', 'ceilingWood', { polygon: eave }, underside, true)

// Intersect the two adjacent offset lines to maintain a continuous miter at each corner.
const eaveNormals = outwardNormals(eave)
const fascia = eave.map(([x, y], i): Point => {
  const [ax, ay] = eaveNormals[(i + eave.length - 1) % eave.length]
  const [bx, by] = eaveNormals[i]
  const scale = 0.04 / (1 + ax * bx + ay * by)
  return [x + (ax + bx) * scale, y + (ay + by) * scale]
})
prism('eave', 'blackMetal', { polygon: fascia, holes: [eave] }, top - fasciaHeight, top)
for (const zone of house.outdoor.filter(zone => zone.key === 'veranda' || zone.key === 'gourmet')) {
  beams('eave', bounds(zone.polygon), underside, false)
}

// Fit the breezeway beams between the eave and the path's inside edge.
const sidePath = house.outdoor.find(zone => zone.key === 'side_path')!
const [sideStart, sideNorth, sideEnd] = bounds(sidePath.polygon)
for (let x = sideStart + 0.9; x < sideEnd; x += 1.8) {
  const crossings = (ring: Ring) => segments(ring).flatMap(([[ax, ay], [bx, by]]) =>
    (ax > x) !== (bx > x) ? [ay + (by - ay) * (x - ax) / (bx - ax)] : []).sort((a, b) => a - b)
  const [roofNorth] = crossings(eave)
  const [, pathSouth] = crossings(sidePath.polygon)
  if (roofNorth === undefined || pathSouth === undefined) continue
  const start = Math.max(sideNorth, roofNorth)
  if (pathSouth - start < 0.03) continue
  prism('eave', 'beam', { polygon: rectangle([x - 0.09, start, x + 0.09, pathSouth]) }, underside - 0.13, underside)
}

export const finishedLayers = Array.from(batches.values(), ({ part, finish, pieces }) => {
  const geometry = mergeGeometries(pieces)
  pieces.forEach(piece => piece.dispose())
  return { part, finish, geometry }
})
batches.clear()

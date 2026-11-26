import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { closestPoint, floorAt, planToWorld, rectangle, segments, type Footprint, type Point } from '../model/geometry'
import { architecturalZones, house, outdoorFeatures, pool } from '../model/house'

type Layer = 'floor' | 'paving' | 'garden' | 'covered' | 'wall' | 'glass' | 'water' | 'basin' | 'trim' | 'roof' | 'ground'
type Height = number | ((x: number) => number)
const groups = new Map<Layer, THREE.BufferGeometry[]>()
const outlines: THREE.BufferGeometry[] = []

export function prismGeometry(footprint: Footprint, bottom: Height, top: Height) {
  const path = (ring: readonly Point[]) => ring.map(([x, y]) => new THREE.Vector2(x, y))
  const shape = new THREE.Shape(path(footprint.polygon))
  shape.holes = (footprint.holes ?? []).map(hole => new THREE.Path(path(hole)))
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 1 })
  const positions = geometry.getAttribute('position')
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const height = positions.getZ(i) ? top : bottom
    positions.setXYZ(i, ...planToWorld([x, positions.getY(i)], typeof height === 'function' ? height(x) : height))
  }
  // Swapping extrusion depth and plan Y reverses triangle winding.
  for (let i = 0; i < positions.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(positions, i + 1)
    const b = new THREE.Vector3().fromBufferAttribute(positions, i + 2)
    positions.setXYZ(i + 1, b.x, b.y, b.z)
    positions.setXYZ(i + 2, a.x, a.y, a.z)
  }
  geometry.computeVertexNormals()
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < positions.count; i++) {
    uv.setXY(i, positions.getX(i) / house.lot.width, 1 - positions.getZ(i) / house.lot.depth)
  }
  return geometry
}

function prism(layer: Layer, footprint: Footprint, bottom: Height, top: Height, edges = false) {
  const geometry = prismGeometry(footprint, bottom, top)
  if (edges) outlines.push(new THREE.EdgesGeometry(geometry, 24))
  const list = groups.get(layer) ?? []
  list.push(geometry)
  groups.set(layer, list)
}

for (const zone of architecturalZones) {
  if (zone.kind === 'pool') continue
  const layer = zone.kind === 'garden' ? 'garden' : zone.kind === 'paving' ? 'paving' : zone.indoor ? 'floor' : 'covered'
  prism(layer, zone, -0.035, x => floorAt(zone, x))
  if (zone.ceiling) prism('roof', zone, zone.floor + zone.ceiling, zone.floor + zone.ceiling + 0.10)
}

prism('ground', { ...house.lot, holes: [pool.polygon, outdoorFeatures.lounge.polygon] }, -0.17, -0.04)
const poolBottom = pool.floor - (pool.depth ?? 1.4)
prism('basin', { polygon: pool.polygon }, poolBottom - 0.12, poolBottom)
const poolEdges = segments(pool.polygon)
const inset = pool.polygon.map(([x, y]): Point => [
  x + Math.sign(pool.label[0] - x) * 0.13,
  y + Math.sign(pool.label[1] - y) * 0.13,
])
for (const [[a, b], i] of poolEdges.map((edge, i) => [edge, i] as const)) {
  const ring = [a, b, inset[(i + 1) % inset.length], inset[i]]
  prism('basin', { polygon: ring }, poolBottom, pool.floor - 0.06)
}
const copingFootprint = { polygon: pool.polygon, holes: [inset] }
prism('covered', copingFootprint, pool.floor - 0.06, pool.floor + 0.015)
prism('water', { polygon: inset }, pool.floor - 0.16, pool.floor - 0.15)

for (const wall of house.walls) prism('wall', wall, wall.base, wall.height, true)
for (const wall of house.perimeterWalls) prism('wall', wall, 0, house.meta.levels.yard + wall.height, true)

export function openingHeights(opening: (typeof house.openings)[number], head: number = house.meta.levels.interior + opening.sill + opening.height) {
  const [x0, y0, x1, y1] = opening.rect
  const alongX = opening.axis === 'x'
  const middleX = (x0 + x1) / 2
  const middleY = (y0 + y1) / 2
  const floor = house.meta.levels.interior
  const sill = floor + opening.sill
  const ends: Point[] = alongX ? [[x0, middleY], [x1, middleY]] : [[middleX, y0], [middleX, y1]]
  const adjacent = ends.map(end => house.walls.map(wall => ({
    height: wall.height,
    distance: Math.min(...segments(wall.polygon).map(([a, b]) => {
      const nearest = closestPoint(end, a, b)
      return Math.hypot(end[0] - nearest[0], end[1] - nearest[1])
    })),
  })).sort((a, b) => a.distance - b.distance)[0])
  const top = Math.max(...adjacent.filter(wall => wall.distance < 0.18).map(wall => wall.height), head)
  return { sill, head, top }
}

for (const opening of house.openings) {
  const [x0, y0, x1, y1] = opening.rect
  const footprint = { polygon: rectangle(opening.rect) }
  const alongX = opening.axis === 'x'
  const middleX = (x0 + x1) / 2
  const middleY = (y0 + y1) / 2
  const floor = house.meta.levels.interior
  const { sill, head, top } = openingHeights(opening)
  if (top > head) prism('wall', footprint, head, top, true)
  if (opening.kind === 'window') {
    prism('wall', footprint, 0, sill, true)
    const pane = alongX ? [x0, middleY - 0.009, x1, middleY + 0.009] : [middleX - 0.009, y0, middleX + 0.009, y1]
    prism('glass', { polygon: rectangle(pane) }, sill, head)
    prism('trim', { polygon: rectangle(pane) }, sill, sill + 0.035)
    prism('trim', { polygon: rectangle(pane) }, head - 0.035, head)
  }
  if (opening.kind !== 'passage') {
    const width = 0.014
    const jambs = alongX
      ? [[x0, y0, x0 + width, y1], [x1 - width, y0, x1, y1]]
      : [[x0, y0, x1, y0 + width], [x0, y1 - width, x1, y1]]
    for (const jamb of jambs) prism('trim', { polygon: rectangle(jamb) }, opening.kind === 'window' ? sill : floor, head)
  }
  if (opening.kind !== 'window') prism('floor', footprint, -0.035, floor - 0.002)
}

export const layers = Array.from(groups, ([layer, geometries]) => {
  const geometry = mergeGeometries(geometries)
  geometries.forEach(part => part.dispose())
  return [layer, geometry] as const
})
groups.clear()
export const edgeLines = mergeGeometries(outlines)
outlines.forEach(part => part.dispose())

// Bake floor contact shading from the footprint at startup on desktop.
export function createFloorOcclusion() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = Math.round(canvas.width * house.lot.depth / house.lot.width)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.filter = 'blur(3px)'
  ctx.strokeStyle = '#555'
  ctx.lineWidth = 9
  ctx.lineJoin = 'round'
  const scale = canvas.width / house.lot.width
  for (const wall of [...house.walls, ...house.perimeterWalls]) {
    for (const ring of [wall.polygon, ...(wall.holes ?? [])]) {
      ctx.beginPath()
      ring.forEach(([x, y], index) => {
        if (index === 0) ctx.moveTo(x * scale, y * scale)
        else ctx.lineTo(x * scale, y * scale)
      })
      ctx.closePath()
      ctx.stroke()
    }
  }
  return new THREE.CanvasTexture(canvas)
}

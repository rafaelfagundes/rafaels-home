import { intersectionArea } from './clearance'
import { footprint, type FurnitureItem } from './furniture'
import { contains, pointInPolygon, type Point, type Ring } from './geometry'
import { house, pool } from './house'
import { defaultItems, GRID, snapToGrid } from './layout'

type PlacementContext = { reference?: FurnitureItem }
const tolerance = 0.01
const blockers = [...house.walls, ...house.perimeterWalls, pool]

function bounds(ring: Ring) {
  return [Math.min(...ring.map(p => p[0])), Math.min(...ring.map(p => p[1])),
    Math.max(...ring.map(p => p[0])), Math.max(...ring.map(p => p[1]))]
}

const blockerBounds = blockers.map(blocker => bounds(blocker.polygon))

function insetFootprint(item: FurnitureItem) {
  const [width, depth, height] = item.size
  return footprint({ ...item, size: [Math.max(width / 2, width - 2 * tolerance), Math.max(depth / 2, depth - 2 * tolerance), height] })
}

export function canPlace(item: FurnitureItem, context: PlacementContext = {}) {
  const corners = footprint(item)
  if (!corners.every(point => contains(house.lot, point))) return false
  const [x, y, u, v] = bounds(corners)
  const defaultItem = defaultItems.get(item.id)
  const reference = context.reference ?? defaultItem
  const inset = insetFootprint(item)
  const previous = reference && insetFootprint(reference)
  return blockers.every((blocker, i) => {
    const [a, b, c, d] = blockerBounds[i]
    if (u <= a || x >= c || v <= b || y >= d) return true
    let allowed = previous ? intersectionArea(blocker.polygon, previous) : 0
    if (blocker === pool && context.reference) {
      const defaultOverlap = defaultItem ? intersectionArea(pool.polygon, insetFootprint(defaultItem)) : 0
      allowed = Math.min(allowed, defaultOverlap)
    }
    return intersectionArea(blocker.polygon, inset) <= allowed + 1e-8
  })
}

export function moveWithCollision(item: FurnitureItem, target: Point): FurnitureItem {
  const [x, y] = item.center
  const [u, v] = snapToGrid([
    Math.max(0, Math.min(house.lot.width, target[0])),
    Math.max(0, Math.min(house.lot.depth, target[1])),
  ])
  const dx = u - x
  const dy = v - y
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (!dx && !dy)) return item
  const steps = Math.ceil(Math.hypot(dx, dy) / (GRID / 2))
  let last = item
  for (let step = 1; step <= steps; step++) {
    const center = snapToGrid([x + dx * step / steps, y + dy * step / steps])
    if (center[0] === last.center[0] && center[1] === last.center[1]) continue
    const ddx = center[0] - last.center[0]
    const ddy = center[1] - last.center[1]
    const count = Math.ceil(Math.hypot(ddx, ddy) / (GRID / 2))
    let previous = last
    for (let index = 1; index <= count; index++) {
      const position: [number, number] = index === count ? center :
        [last.center[0] + ddx * index / count, last.center[1] + ddy * index / count]
      const next = { ...item, center: position }
      if (!canPlace(next, { reference: previous })) return last
      previous = next
    }
    last = previous
  }
  return last
}

const nudgeRadius = 0.6

function nearestValidCenter(item: FurnitureItem, context: PlacementContext = {}) {
  const [x, y] = item.center
  const [gridX, gridY] = snapToGrid(item.center)
  const steps = Math.ceil(nudgeRadius / GRID)
  const candidates: { center: FurnitureItem['center']; distance: number }[] = []
  for (let dx = -steps; dx <= steps; dx++) {
    for (let dy = -steps; dy <= steps; dy++) {
      const center = snapToGrid([gridX + dx * GRID, gridY + dy * GRID])
      const distance = Math.hypot(center[0] - x, center[1] - y)
      if (distance > 0 && distance <= nudgeRadius + 1e-9) candidates.push({ center, distance })
    }
  }
  candidates.sort((a, b) => a.distance - b.distance)
  return candidates.find(({ center }) => canPlace({ ...item, center }, context))?.center
}

export function rotationSpot(item: FurnitureItem, facing: number) {
  const rotated = { ...item, facing }
  const context = { reference: item }
  return canPlace(rotated, context) ? item.center : nearestValidCenter(rotated, context)
}

export function duplicateSpot(item: FurnitureItem) {
  const copy = { ...item, id: '' }
  // Offset a copy when possible so it can be picked apart from its source.
  const center = snapToGrid([item.center[0] + 0.3, item.center[1]])
  if (canPlace(copy) && canPlace({ ...copy, center })) return center
  return nearestValidCenter(copy)
}

export function pickPiece(items: FurnitureItem[], point: Point) {
  return items.filter(item => pointInPolygon(point, footprint(item))).sort((a, b) =>
    Number(a.kind === 'rug') - Number(b.kind === 'rug') ||
    a.size[0] * a.size[1] - b.size[0] * b.size[1] ||
    (b.elevation ?? 0) - (a.elevation ?? 0))[0]
}

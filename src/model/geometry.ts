export type Point = readonly [number, number]
export type WorldPoint = [number, number, number]
export type Ring = readonly Point[]
export interface Footprint { polygon: Ring; holes?: readonly Ring[] }
export interface Floor extends Footprint {
  floor: number
  slope?: { axis: 'x'; from_: number; to: number }
}

export const planToWorld = ([x, y]: Point, elevation: number): WorldPoint => [x, elevation, y]

export function segments(ring: Ring) {
  return ring.map((start, i) => [start, ring[(i + 1) % ring.length]] as const)
}

export function closestPoint([x, y]: Point, [ax, ay]: Point, [bx, by]: Point): Point {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared)) : 0
  return [ax + t * dx, ay + t * dy]
}

export function pointInPolygon(point: Point, ring: Ring): boolean {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j]
    const [bx, by] = ring[i]
    const [px, py] = closestPoint(point, ring[j], ring[i])
    if (Math.abs(px - x) < 1e-8 && Math.abs(py - y) < 1e-8) return true
    if ((ay > y) !== (by > y) && x < ax + (bx - ax) * (y - ay) / (by - ay)) inside = !inside
  }
  return inside
}

export function contains(footprint: Footprint, point: Point) {
  return pointInPolygon(point, footprint.polygon) && !footprint.holes?.some(hole => pointInPolygon(point, hole))
}

function ringArea(ring: Ring) {
  return Math.abs(segments(ring).reduce((sum, [[x, y], [u, v]]) => sum + x * v - u * y, 0)) / 2
}

export function polygonArea({ polygon, holes = [] }: Footprint) {
  return ringArea(polygon) - holes.reduce((sum, hole) => sum + ringArea(hole), 0)
}

export function floorAt(zone: Floor, x: number) {
  if (!zone.slope) return zone.floor
  const end = Math.max(...zone.polygon.map(point => point[0]))
  const fraction = Math.max(0, Math.min(1, x / end))
  return zone.slope.from_ + fraction * (zone.slope.to - zone.slope.from_)
}

export function floorElevation(point: Point, zones: readonly Floor[], fallback = 0.28) {
  const zone = zones.find(zone => contains(zone, point))
  if (zone) return floorAt(zone, point[0])
  // Door thresholds can sit between two floor polygons.
  let nearest = 0.2
  let height = fallback
  for (const zone of zones) {
    for (const [a, b] of segments(zone.polygon)) {
      const [x, y] = closestPoint(point, a, b)
      const distance = Math.hypot(x - point[0], y - point[1])
      if (distance >= nearest) continue
      nearest = distance
      height = floorAt(zone, point[0])
    }
  }
  return height
}

export function rectangle([x0, y0, x1, y1]: readonly number[]): Ring {
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
}

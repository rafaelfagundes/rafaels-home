import { closestPoint, contains, pointInPolygon, segments, type Footprint, type Point } from './geometry'

export const PLAYER_RADIUS = 0.25

export function createCollision(lot: Footprint, obstacles: readonly Footprint[], radius = PLAYER_RADIUS) {
  const solids = obstacles.map(shape => ({
    shape,
    edges: [shape.polygon, ...(shape.holes ?? [])].flatMap(segments),
  }))
  const boundary = segments(lot.polygon)

  function contact(point: Point): { normal: Point } | undefined {
    const findEdge = (edges: ReturnType<typeof segments>, inside: boolean) => {
      let distance = Infinity
      let normal: Point = [0, 0]
      for (const [a, b] of edges) {
        const [x, y] = closestPoint(point, a, b)
        const dx = point[0] - x
        const dy = point[1] - y
        const length = Math.hypot(dx, dy)
        if (length >= distance) continue
        distance = length
        normal = length ? [dx / length, dy / length] : [0, 0]
      }
      if (inside) return { normal: [-normal[0], -normal[1]] as Point }
      return distance < radius - 1e-8 ? { normal } : undefined
    }
    const lotContact = findEdge(boundary, !pointInPolygon(point, lot.polygon))
    if (lotContact) return lotContact
    for (const { shape, edges } of solids) {
      const hit = findEdge(edges, contains(shape, point))
      if (hit) return hit
    }
  }

  const isFree = (point: Point) => !contact(point)

  function move(start: Point, delta: Point): Point {
    const count = Math.max(1, Math.ceil(Math.hypot(...delta) / (radius * 0.3)))
    const dx = delta[0] / count
    const dy = delta[1] / count
    let [x, y] = start
    for (let i = 0; i < count; i++) {
      const hit = contact([x + dx, y + dy])
      if (!hit) {
        x += dx
        y += dy
        continue
      }
      const [nx, ny] = hit.normal
      const inward = Math.min(0, dx * nx + dy * ny)
      const slide: Point = [x + dx - inward * nx, y + dy - inward * ny]
      if (isFree(slide)) {
        x = slide[0]
        y = slide[1]
      } else if (isFree([x + dx, y])) {
        x += dx
      } else if (isFree([x, y + dy])) {
        y += dy
      }
    }
    return [x, y]
  }

  return { isFree, move }
}

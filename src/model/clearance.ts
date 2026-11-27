import { closestPoint, polygonArea, rectangle, segments, type Point, type Ring } from './geometry'
import type { house } from './house'

export const overlapTolerance = 1e-4

export function doorClearance(opening: (typeof house.openings)[number]): Ring | undefined {
  if (opening.kind === 'window' && (opening.sill > 0.05 || opening.height < 2)) return
  const [west, north, east, south] = opening.rect
  return rectangle(opening.axis === 'x'
    ? [west, north - 0.8, east, south + 0.8]
    : [west - 0.8, north, east + 0.8, south])
}

// The clipping box is a counterclockwise convex polygon in plan coordinates.
export function intersectionArea(subject: Ring, box: Ring) {
  let polygon = subject
  for (const [[ax, ay], [bx, by]] of segments(box)) {
    const side = ([x, y]: Point) => (bx - ax) * (y - ay) - (by - ay) * (x - ax)
    polygon = segments(polygon).flatMap(([start, end]): Point[] => {
      const from = side(start)
      const to = side(end)
      const points: Point[] = from >= 0 ? [start] : []
      if ((from >= 0) !== (to >= 0)) {
        const fraction = from / (from - to)
        points.push([start[0] + (end[0] - start[0]) * fraction, start[1] + (end[1] - start[1]) * fraction])
      }
      return points
    })
  }
  return polygonArea({ polygon })
}

// For disjoint convex polygons the shortest gap joins a vertex to an edge.
export function polygonDistance(a: Ring, b: Ring): number {
  if (intersectionArea(a, b) > 0) return 0
  const vertexToEdge = (vertices: Ring, edges: Ring) => Math.min(...vertices.flatMap(point =>
    segments(edges).map(([start, end]) => {
      const nearest = closestPoint(point, start, end)
      return Math.hypot(point[0] - nearest[0], point[1] - nearest[1])
    })))
  return Math.min(vertexToEdge(a, b), vertexToEdge(b, a))
}

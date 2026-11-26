import { contains, polygonArea, segments, type Footprint, type Point, type Ring } from './geometry'
import type { Zone } from './house'

export function outwardNormals(ring: Ring, hole = false): Point[] {
  const edges = segments(ring)
  const signedArea = edges.reduce((sum, [[ax, ay], [bx, by]]) => sum + ax * by - ay * bx, 0)
  const side = (signedArea < 0 ? -1 : 1) * (hole ? -1 : 1)
  return edges.map(([[ax, ay], [bx, by]]) => {
    const dx = bx - ax
    const dy = by - ay
    const length = Math.hypot(dx, dy) || 1
    return [side * dy / length, -side * dx / length]
  })
}

export function isStoneTileRoom(key: string) {
  return key === 'bathroom' || key === 'master_bath' || key === 'powder_room'
}

export function classifyWallFace(
  wall: Footprint & { kind?: string }, a: Point, b: Point, normal: Point,
  rooms: readonly Pick<Zone, 'polygon' | 'holes' | 'indoor' | 'key'>[],
) {
  const [nx, ny] = normal
  const x = (a[0] + b[0]) / 2
  const y = (a[1] + b[1]) / 2
  const room = rooms.find(room => room.indoor && contains(room, [x + nx * 0.10, y + ny * 0.10]))
  if (room) {
    if (ny > 0.9 && Math.abs(y - 5.62) < 0.03 && (room.key === 'living' || room.key === 'dining')) return 'feature'
    return isStoneTileRoom(room.key) ? 'stoneTile' : 'plaster'
  }
  if (wall.kind === 'pillar' || polygonArea(wall) < 0.35 || (nx < -0.9 && y < 5.7)) return 'stackedStone'
  return ny < -0.9 || y > 12.8 ? 'stucco' : 'cladding'
}

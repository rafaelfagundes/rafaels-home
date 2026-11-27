import { describe, expect, it } from 'vitest'
import { footprint, furnitureColliders, furnitureItems, garageFit, vehicleColliders, vehicleItems } from './furniture'
import { closestPoint, contains, polygonArea, segments, type Point, type Ring } from './geometry'
import { collision, house, walkCollisionFor, whiteCollision, zonePose, zones } from './house'
import { planters, trees } from './landscape'
import { defaults } from './settings'
import { useApp } from './store'

// The clipping box is a counterclockwise rectangle in plan coordinates.
function intersectionArea(subject: Ring, box: Ring) {
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

describe('furniture and vehicle layout', () => {
  it.each([...furnitureItems, ...vehicleItems])('$id fits within its zone and clears walls', item => {
    const zone = zones.find(zone => zone.id === item.room)!
    const [width, depth, height] = item.size
    // Inset each edge by 1 cm for the room check. Test the full box against walls.
    const inset = footprint({ ...item, size: [width - 0.02, depth - 0.02, height] })
    const covered = intersectionArea(zone.polygon, inset) -
      (zone.holes ?? []).reduce((sum, hole) => sum + intersectionArea(hole, inset), 0)
    expect(covered, zone.id).toBeCloseTo(polygonArea({ polygon: inset }), 8)
    const box = footprint(item)
    const boundary = [zone.polygon, ...(zone.holes ?? [])].flatMap(segments)
    for (const corner of box) {
      if (contains(zone, corner)) continue
      const distance = Math.min(...boundary.map(([start, end]) => {
        const [x, y] = closestPoint(corner, start, end)
        return Math.hypot(x - corner[0], y - corner[1])
      }))
      expect(distance, zone.id).toBeLessThanOrEqual(0.01 + 1e-8)
    }
    for (const wall of [...house.walls, ...house.perimeterWalls]) {
      expect(intersectionArea(wall.polygon, box), wall.id).toBeLessThan(1e-8)
    }
    if (item.room === 'pool_deck') {
      for (const obstacle of [...planters, ...trees]) {
        expect(intersectionArea(obstacle.polygon, box), obstacle.point.join(', ')).toBeLessThan(1e-8)
      }
    }
  })

  it('keeps collider footprints clear of one another', () => {
    const items = [...furnitureItems, ...vehicleItems].filter(item => item.collider !== false)
    const colliders = [...furnitureColliders, ...vehicleColliders]
    for (const [index, { polygon }] of colliders.entries()) {
      for (let other = 0; other < index; other++) {
        expect(intersectionArea(colliders[other].polygon, polygon), `${items[index].id} / ${items[other].id}`).toBeLessThan(1e-8)
      }
    }
  })

  it('leaves the required garage clearances', () => {
    const { walkwayWidth, ...clearances } = garageFit()
    expect(walkwayWidth).toBeGreaterThanOrEqual(0.8)
    for (const [name, clearance] of Object.entries(clearances)) {
      expect(clearance, name).toBeGreaterThanOrEqual(0.2)
    }
  })
})

describe('walking collision', () => {
  it('reuses the collision for the same style and toggles', () => {
    expect(walkCollisionFor(defaults)).toBe(walkCollisionFor({ ...defaults }))
    expect(walkCollisionFor({ ...defaults, furniture: false, vehicles: false })).toBe(collision)
    expect(walkCollisionFor({ ...defaults, style: 'white', furniture: false, vehicles: false })).toBe(whiteCollision)
  })

  it('only blocks bed and vehicle centres while their respective settings are enabled', () => {
    const beds = furnitureItems.filter(item => item.kind === 'bedQueen' || item.kind === 'bedKing')
    for (const bed of beds) {
      expect(walkCollisionFor(defaults).isFree(bed.center)).toBe(false)
      expect(walkCollisionFor({ ...defaults, furniture: false }).isFree(bed.center)).toBe(true)
    }
    for (const vehicle of vehicleItems) {
      expect(walkCollisionFor(defaults).isFree(vehicle.center)).toBe(false)
      expect(walkCollisionFor({ ...defaults, vehicles: false }).isFree(vehicle.center)).toBe(true)
    }
  })

  it.each(zones)('finds a free jump destination for $id', zone => {
    for (const style of ['finished', 'white'] as const) {
      const walk = walkCollisionFor({ ...defaults, style })
      expect(walk.isFree(zonePose(zone, walk).position), style).toBe(true)
    }
  })

  it('keeps the routes to the laundry and between dining chairs and stools open', () => {
    const walk = walkCollisionFor(defaults)
    expect(walk.move([3, 13.425], [6.4, 0])[0]).toBeCloseTo(9.4)
    expect(walk.move([8.55, 9], [3.25, 0])[0]).toBeCloseTo(11.8)
  })

  it.each([
    ['furniture', furnitureItems[0]],
    ['vehicles', vehicleItems[0]],
  ] as const)('moves the camera clear when enabling %s', (setting, item) => {
    const previous = useApp.getState()
    try {
      useApp.setState({
        settings: { ...defaults, [setting]: false },
        pose: { position: item.center, heading: 1, pitch: 0.2 },
        target: item.center,
      })
      useApp.getState().changeSettings({ [setting]: true })
      const { pose, settings, target } = useApp.getState()
      expect(walkCollisionFor(settings).isFree(pose.position)).toBe(true)
      expect(pose).toMatchObject({ heading: 1, pitch: 0.2 })
      expect(target).toBeNull()
    } finally {
      useApp.setState(previous)
    }
  })
})

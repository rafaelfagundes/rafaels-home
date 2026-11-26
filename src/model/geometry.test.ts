import { describe, expect, it } from 'vitest'
import { createCollision } from './collision'
import { contains, floorElevation, planToWorld, pointInPolygon, polygonArea, rectangle } from './geometry'
import { collision, house, p10FixedEnd, pool, whiteCollision, zonePose, zones } from './house'

describe('blueprint geometry', () => {
  it('preserves the plan axes in world space', () => {
    expect(planToWorld([3, 7], 0.47)).toEqual([3, 0.47, 7])
  })

  it('handles concave footprints, boundaries and holes', () => {
    const ring = [[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]] as const
    expect(pointInPolygon([1, 3], ring)).toBe(true)
    expect(pointInPolygon([3, 3], ring)).toBe(false)
    expect(pointInPolygon([2, 3], ring)).toBe(true)
    expect(contains({ polygon: ring, holes: [rectangle([0.5, 0.5, 1.5, 1.5])] }, [1, 1])).toBe(false)
  })

  it('matches extracted room and outdoor areas within one percent', () => {
    for (const zone of zones) {
      expect(Math.abs(polygonArea(zone) / zone.areaComputed - 1), zone.key).toBeLessThan(0.01)
    }
  })

  it('returns room elevations and interpolates the driveway ramp', () => {
    expect(floorElevation(house.rooms.find(zone => zone.key === 'living')!.label, zones)).toBe(0.47)
    const driveway = zones.find(zone => zone.key === 'driveway')!
    const end = Math.max(...driveway.polygon.map(([x]) => x))
    expect(floorElevation([end / 2, driveway.label[1]], zones)).toBeCloseTo(0.14)
  })
})

describe('walking collision', () => {
  const lot = { polygon: rectangle([0, 0, 10, 10]) }
  const walls = [{ polygon: rectangle([4, 1, 4.2, 4]) }, { polygon: rectangle([4, 5, 4.2, 9]) }]
  const walker = createCollision(lot, walls)

  it('cannot tunnel through a wall even with a large movement', () => {
    const [x, y] = walker.move([2, 2], [5, 0])
    expect(x).toBeLessThanOrEqual(3.75)
    expect(x).toBeGreaterThan(3.65)
    expect(y).toBe(2)
  })

  it('slides along a wall while maintaining clearance', () => {
    const [x, y] = walker.move([3.7, 2], [1, 1])
    expect(x).toBeLessThanOrEqual(3.75)
    expect(y).toBeCloseTo(3)
  })

  it('can pass through a door gap, including the extracted front door', () => {
    expect(walker.move([2, 4.5], [4, 0])[0]).toBeCloseTo(6)
    expect(collision.move([3.75, 12.3], [1.5, 0])[0]).toBeCloseTo(5.25)
  })

  it('blocks the north P10 pane and leaves the south doorway walkable in finished style', () => {
    const [x, north, east, south] = house.openings.find(opening => opening.id === 'P10')!.rect
    const paneY = (north + p10FixedEnd) / 2
    const doorY = (p10FixedEnd + south) / 2
    expect(collision.move([x - 0.6, paneY], [1.3, 0])[0]).toBeLessThanOrEqual(x - 0.25)
    expect(collision.move([x - 0.6, doorY], [1.3, 0])[0]).toBeGreaterThan(east + 0.25)
    expect(whiteCollision.move([x - 0.6, paneY], [1.3, 0])[0]).toBeGreaterThan(east + 0.25)
  })

  it('keeps the player in bounds and out of the window and pool', () => {
    expect(walker.move([1, 1], [-3, 0])[0]).toBeGreaterThanOrEqual(0.25)
    expect(collision.isFree(house.openings.find(opening => opening.kind === 'window')!.center)).toBe(false)
    expect(collision.isFree(pool.label)).toBe(false)
  })

  it('provides a walkable destination for every room-list entry', () => {
    for (const zone of zones) expect(collision.isFree(zonePose(zone).position), zone.key).toBe(true)
  })

  it.each(['fire_lounge', 'pool_deck', 'pool', 'terrace', 'garden', 'wood_deck', 'veranda', 'gourmet'])(
    'faces the indoor centroid from the %s destination',
    key => {
      const zone = zones.find(zone => zone.key === key)!
      // Area-weighted centroid of the indoor floor polygons in the blueprint.
      const center = [10.22217493154, 7.33087264455]
      for (const walkCollision of [collision, whiteCollision]) {
        const { position: [x, y], heading } = zonePose(zone, walkCollision)
        expect(heading).toBeCloseTo(Math.atan2(center[1] - y, center[0] - x), 8)
      }
    },
  )

  it('faces at least four metres of clear space from the living room destination', () => {
    const living = house.rooms.find(zone => zone.key === 'living')!
    const { position: [x, y], heading } = zonePose(living)
    for (let step = 1; step <= 80; step++) {
      const distance = step / 20
      expect(collision.isFree([x + Math.cos(heading) * distance, y + Math.sin(heading) * distance]), `${distance} m`).toBe(true)
    }
  })
})

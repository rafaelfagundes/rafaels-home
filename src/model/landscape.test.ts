import { describe, expect, it } from 'vitest'
import { contains, floorElevation, polygonArea, type Point } from './geometry'
import { collision, house, outdoorFeatures, plantExclusions, pool, walkingFloors, whiteCollision, zonePose, zones } from './house'
import { generatePlants, planters, trees } from './landscape'

describe('landscape placement', () => {
  it('uses seeded placement and populates each plant family within the instance budget', () => {
    const plants = generatePlants(walkingFloors, plantExclusions)
    expect(generatePlants(walkingFloors, plantExclusions)).toEqual(plants)
    expect(generatePlants(walkingFloors, plantExclusions, 100)).not.toEqual(plants)
    expect(new Set(plants.map(plant => plant.kind))).toEqual(new Set(['bamboo', 'horsetail', 'fescue', 'feather']))
    const additionalInstances = 6 * 7 + 6 + 27
    expect(plants.length + plants.filter(plant => plant.kind === 'bamboo').length + additionalInstances)
      .toBeLessThanOrEqual(2500)
  })

  it('keeps vegetation and planters clear of the house, pool and walkways', () => {
    const walkways = zones.filter(zone => ['front_walk', 'entry_walk', 'side_path', 'rear_path', 'wood_deck'].includes(zone.key))
    const forbidden = [...house.rooms, ...house.walls, pool, ...walkways]
    const plants = generatePlants(walkingFloors, plantExclusions)
    const points = [...plants.map(plant => plant.point),
      ...[...trees, ...planters].flatMap(item => [item.point, ...item.polygon])]
    for (const point of points) {
      expect(forbidden.find(shape => contains(shape, point)), point.join(', ')).toBeUndefined()
    }
    for (const obstacle of [...trees, ...planters]) {
      expect(collision.isFree(obstacle.point)).toBe(false)
      expect(whiteCollision.isFree(obstacle.point)).toBe(false)
    }
  })
})

describe('fire-pit lounge', () => {
  const { lounge, steps, fireCenter, bench } = outdoorFeatures

  it('adds an outdoor room of 11.76 square metres separate from the pool and terrace', () => {
    expect(zones.find(zone => zone.key === 'fire_lounge')).toBe(lounge)
    expect(lounge.indoor).toBe(false)
    expect(lounge.areaComputed).toBeCloseTo(11.76)
    expect(polygonArea(lounge)).toBeCloseTo(11.76)
    const terrace = house.outdoor.find(zone => zone.key === 'terrace')!
    const loungeWest = Math.min(...lounge.polygon.map(([x]) => x))
    const loungeSouth = Math.max(...lounge.polygon.map(([, y]) => y))
    expect(loungeWest).toBeGreaterThan(Math.max(...terrace.polygon.map(([x]) => x)))
    expect(loungeSouth).toBeLessThan(Math.min(...pool.polygon.map(([, y]) => y)))
  })

  it('descends from the west in 0.15 m steps to a walkable floor at −0.15 m', () => {
    const approach: Point = [21.1, 8.3]
    expect(floorElevation(approach, walkingFloors)).toBeCloseTo(0.3)
    steps.forEach((step, index) => {
      const [a, b] = step.polygon
      expect(floorElevation([(a[0] + b[0]) / 2, 8.3], walkingFloors)).toBeCloseTo(0.15 - index * 0.15)
    })
    const destination = zonePose(lounge).position
    expect(contains(lounge, destination)).toBe(true)
    expect(collision.isFree(destination)).toBe(true)
    expect(floorElevation(destination, zones)).toBeCloseTo(-0.15)
    const [x, y] = collision.move(approach, [1, 0])
    expect(x).toBeCloseTo(22.1)
    expect(floorElevation([x, y], walkingFloors)).toBeCloseTo(-0.15)
    expect(collision.isFree(fireCenter)).toBe(false)
    expect(collision.isFree(bench[0].polygon[0])).toBe(false)
  })
})

import { expect, it } from 'vitest'
import { doorClearance, intersectionArea, overlapTolerance, polygonDistance, wideSliderClearance } from './clearance'
import { footprint, furnitureItems, vehicleItems, type FurnitureItem } from './furniture'
import { house } from './house'
import { createCollision } from './collision'
import { rectangle, type Point } from './geometry'

const items = [...furnitureItems, ...vehicleItems]
const elevatedOrFlat = (item: FurnitureItem) => item.kind === 'rug' || (item.elevation ?? 0) >= 1.9

it('keeps the required door clearance around furniture and vehicles', () => {
  const obstacles = items.filter(item => !elevatedOrFlat(item)).map(item => ({ id: item.id, polygon: footprint(item) }))
  const violations: string[] = []
  for (const opening of house.openings) {
    const slider = wideSliderClearance(opening, obstacles.map(item => item.polygon))
    if (slider) {
      for (const [side, { longestClear, blockedFraction }] of slider.entries()) {
        if (longestClear < 1.2 - 1e-8 || blockedFraction > 0.5 + 1e-8) {
          violations.push(`${opening.id} side ${side + 1}: ${longestClear.toFixed(3)} m clear, ${(blockedFraction * 100).toFixed(1)}% blocked`)
        }
      }
      continue
    }
    const zone = doorClearance(opening)
    if (!zone) continue
    for (const item of obstacles) {
      const area = intersectionArea(item.polygon, zone)
      if (area > overlapTolerance) violations.push(`${item.id} / ${opening.id}: ${area.toFixed(5)} m²`)
    }
  }
  expect(violations, violations.join('\n')).toEqual([])
})

it('merges overlapping obstructions and measures the longest clear section on each side', () => {
  const opening = house.openings.find(opening => opening.id === 'P10')!
  const [west, north, east] = opening.rect
  const obstructions = [
    rectangle([east, north + 1, east + 0.4, north + 3]),
    rectangle([east + 0.4, north + 2, east + 1, north + 4]),
    rectangle([west - 1, north + 2, west - 0.8, north + 4]),
  ]
  const [inside, outside] = wideSliderClearance(opening, obstructions)!
  expect(inside).toEqual({ longestClear: opening.rect[3] - north, blockedFraction: 0 })
  expect(outside.blockedFraction).toBeCloseTo(3 / (opening.rect[3] - north))
  expect(outside.longestClear).toBeCloseTo(opening.rect[3] - north - 4)
  expect(wideSliderClearance({ ...opening, operation: 'swing' }, obstructions)).toBeUndefined()
  expect(wideSliderClearance({ ...opening, rect: [west, north, east, north + 3] }, obstructions)).toBeUndefined()
})

const intendedOverlaps: [FurnitureItem['kind'], FurnitureItem['kind'], string][] = [
  ['desk', 'deskChair', 'Chair tucks under the desk'],
  ['diningTable', 'diningChair', 'Chairs tuck under the table'],
  ['outdoorTable', 'outdoorChair', 'Chairs tuck under the table'],
  ['mediaConsole', 'tv', 'TV sits above the console'],
  ['showerTray', 'showerGlass', 'Glass meets the tray edge'],
  ['showerTray', 'showerMixer', 'Mixer is mounted above the tray'],
  ['vanity', 'mirror', 'Mirror is mounted above the vanity'],
  ['basin', 'roundMirror', 'Mirror is mounted above the basin'],
  ['washer', 'dryer', 'Dryer stacks on the washer'],
]

it('has no overlapping furniture within a room', () => {
  const violations: string[] = []
  for (const [index, item] of items.entries()) {
    if (elevatedOrFlat(item)) continue
    for (const other of items.slice(index + 1)) {
      if (other.room !== item.room || elevatedOrFlat(other)) continue
      if (intendedOverlaps.some(([a, b]) =>
        (item.kind === a && other.kind === b) || (item.kind === b && other.kind === a))) continue
      const area = intersectionArea(footprint(item), footprint(other))
      if (area > overlapTolerance) violations.push(`${item.id} / ${other.id}: ${area.toFixed(5)} m²`)
    }
  }
  expect(violations, violations.join('\n')).toEqual([])
})

it('keeps a 0.6 m pull-out zone at every desk', () => {
  const violations: string[] = []
  for (const desk of items.filter(item => item.kind === 'desk')) {
    const facing = desk.facing * Math.PI / 180
    const offset = desk.size[1] / 2 + 0.3
    const pullOut = footprint({
      ...desk,
      center: [desk.center[0] + offset * Math.cos(facing), desk.center[1] + offset * Math.sin(facing)],
      size: [desk.size[0], 0.6, 0],
    })
    const chair = items.find(item => item.room === desk.room && item.kind === 'deskChair' &&
      intersectionArea(footprint(item), pullOut) > overlapTolerance)
    for (const other of items) {
      if (other === desk || other === chair) continue
      const needsBedClearance = desk.room === other.room &&
        (other.kind === 'bedQueen' || other.kind === 'bedKing' || other.kind === 'nightstand')
      if (needsBedClearance) {
        for (const [label, polygon] of [
          ['desk', footprint(desk)],
          ['pull-out', pullOut],
          ...(chair ? [['chair', footprint(chair)] as const] : []),
        ] as const) {
          const gap = polygonDistance(polygon, footprint(other))
          if (gap < 0.2 - 1e-8) violations.push(`${desk.id} ${label} / ${other.id}: ${gap.toFixed(3)} m gap`)
        }
      }
      const area = intersectionArea(footprint(other), pullOut)
      if (area > overlapTolerance) violations.push(`${desk.id} pull-out / ${other.id}: ${area.toFixed(5)} m²`)
    }
  }
  expect(violations, violations.join('\n')).toEqual([])
})

it.each([
  // Cross between the room divider and sofa, then turn north before the bar stools.
  ['P01 to dining', [[4.05, 12.30], [5.01, 12.30], [5.01, 9.37], [8.09, 9.37], [8.09, 9.00], [8.69, 9.00]]],
  ['P02 to dining', [[7.38, 5.15], [7.38, 6.74], [8.69, 6.74]]],
] satisfies [string, Point[]][])('keeps a 0.6 m route from %s', (_route, points) => {
  const walk = createCollision(house.lot, [
    ...house.walls,
    ...items.filter(item => !elevatedOrFlat(item)).map(item => ({ polygon: footprint(item) })),
  ], 0.3)
  expect(walk.isFree(points[0])).toBe(true)
  for (const [index, [x, y]] of points.slice(1).entries()) {
    const start = points[index]
    const end = walk.move(start, [x - start[0], y - start[1]])
    expect(end[0], `route to (${x}, ${y})`).toBeCloseTo(x, 6)
    expect(end[1], `route to (${x}, ${y})`).toBeCloseTo(y, 6)
  }
})

it('translates the semi-suite rooms and furnishings 6.24 m east', () => {
  const left = items.filter(item => item.room === 'semi_suite_1')
  const right = items.filter(item => item.room === 'semi_suite_2')
  expect(right).toHaveLength(left.length)
  for (const [index, item] of left.entries()) {
    const { id, room, center: [x, y], ...furnishing } = item
    const { id: rightId, room: rightRoom, center, ...rightFurnishing } = right[index]
    expect(rightId).toBe(id.replace(room, rightRoom))
    expect(rightFurnishing).toStrictEqual(furnishing)
    expect(center).toStrictEqual([x + 6.24, y])
  }

  const leftRoom = house.rooms.find(room => room.id === 'semi_suite_1')!
  const rightRoom = house.rooms.find(room => room.id === 'semi_suite_2')!
  expect(rightRoom.polygon).toHaveLength(leftRoom.polygon.length)
  for (const [index, [x, y]] of leftRoom.polygon.entries()) {
    expect(rightRoom.polygon[index][0]).toBeCloseTo(x + 6.24, 8)
    expect(rightRoom.polygon[index][1]).toBe(y)
  }
})

it('keeps the breakfast bar flush with the island and at counter-stool height', () => {
  const bar = items.find(item => item.kind === 'breakfastBar')!
  const island = items.find(item => item.kind === 'island')!
  expect(Math.abs(bar.size[2] - island.size[2])).toBeLessThanOrEqual(0.01)

  const stools = items.filter(item => item.kind === 'barStool')
  expect(stools).toHaveLength(3)
  for (const stool of stools) {
    const gap = bar.size[2] - stool.size[2]
    expect(gap).toBeGreaterThanOrEqual(0.23)
    expect(gap).toBeLessThanOrEqual(0.32)
  }
})

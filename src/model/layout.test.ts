import { describe, expect, it } from 'vitest'
import { furnitureItems, vehicleItems } from './furniture'
import {
  applyLayout, emptyChanges, MAX_LAYOUT_BYTES, parseLayoutFile, rotate, snapFacing, snapToGrid, validateLayoutFile,
  type LayoutFile,
} from './layout'

function layoutFile(): LayoutFile {
  return {
    schema: 'rafaels-house/layout', version: 1, name: '  Weekend  ', savedAt: '2026-01-01T00:00:00.000Z',
    changes: emptyChanges(),
  }
}

describe('layout files', () => {
  it('normalizes placements and keeps additions attached to their base item group', () => {
    const file = layoutFile()
    const sofa = furnitureItems.find(item => item.kind === 'sofa')!
    file.changes.moved[sofa.id] = { center: [7.126, 9.674], facing: -17 }
    file.changes.removed.push(furnitureItems[0].id)
    file.changes.added.push({ id: 'copy', base: vehicleItems[0].id, center: [6.131, 15], facing: 367 })
    file.person = { position: [3.76, 12.3], heading: 0.6 }
    const result = validateLayoutFile(file)
    expect(result).toMatchObject({ ok: true, layout: { name: 'Weekend', person: { position: [3.75, 12.3], heading: 0.6 } } })
    if (!result.ok) throw new Error(result.error)
    const { furniture, vehicles } = applyLayout(result.layout.changes)
    expect(furniture.find(item => item.id === sofa.id)).toMatchObject({ center: [7.15, 9.65], facing: 345 })
    expect(furniture.some(item => item.id === furnitureItems[0].id)).toBe(false)
    expect(vehicles.at(-1)).toMatchObject({ id: 'copy', kind: 'bmw_x5', center: [6.15, 15], facing: 0 })
  })

  it.each([
    [null, 'schema'],
    [{ ...layoutFile(), schema: 'unknown' }, 'schema'],
    [{ ...layoutFile(), version: 2 }, 'newer'],
    [{ ...layoutFile(), version: undefined }, 'version'],
    [{ ...layoutFile(), version: 0 }, 'version'],
    [{ ...layoutFile(), name: '  ' }, 'name'],
    [{ ...layoutFile(), savedAt: 'yesterday' }, 'changes'],
    [{ ...layoutFile(), changes: { ...emptyChanges(), moved: { a: { center: [1, 2, 3], facing: 1 } } } }, 'changes'],
    [{ ...layoutFile(), changes: { ...emptyChanges(), moved: { a: { center: [1, 2], facing: '90' } } } }, 'changes'],
    [{ ...layoutFile(), changes: { ...emptyChanges(), moved: { a: { center: [NaN, 2], facing: 1 } } } }, 'changes'],
    [{ ...layoutFile(), changes: { ...emptyChanges(), moved: { a: { center: [2, 4], facing: Infinity } } } }, 'changes'],
    [{ ...layoutFile(), person: { position: [200, 1], heading: 0 } }, 'outside'],
    [{ ...layoutFile(), changes: { ...emptyChanges(), moved: { a: { center: [-0.01, 2], facing: 0 } } } }, 'outside'],
    [{ ...layoutFile(), changes: { ...emptyChanges(), added: Array(501).fill(null) } }, 'large'],
    [{ ...layoutFile(), extra: 'é'.repeat(MAX_LAYOUT_BYTES / 2) }, 'large'],
  ])('rejects invalid file %# with %s', (file, error) => {
    expect(validateLayoutFile(file)).toEqual({ ok: false, error })
  })

  it('rejects invalid JSON and oversized input', () => {
    expect(parseLayoutFile('{')).toEqual({ ok: false, error: 'json' })
    expect(parseLayoutFile(' '.repeat(MAX_LAYOUT_BYTES + 1))).toEqual({ ok: false, error: 'large' })
  })

  it('skips absent IDs and counts distinct missing pieces', () => {
    const changes = {
      moved: { missing: { center: [3, 4] as [number, number], facing: 0 } },
      removed: ['missing', 'another'],
      added: [{ id: 'copy', base: 'missing', center: [3, 4] as [number, number], facing: 0 }],
    }
    expect(applyLayout(changes)).toEqual({ furniture: furnitureItems, vehicles: vehicleItems, skipped: 3 })
  })
})

it('snaps to a 5 cm grid and rotates in 15° steps', () => {
  expect(snapToGrid([1.024, 4.077])).toEqual([1, 4.1])
  expect(snapFacing(374)).toBe(15)
  expect(snapFacing(-7)).toBe(0)
  expect(rotate(0, -15)).toBe(345)
  expect(rotate(300, 90)).toBe(30)
})

it('carries built-in component offsets along with a moved and rotated piece', () => {
  const base = furnitureItems.find(piece => piece.kind === 'kitchenBase')!
  const sink = base.components?.find(component => component.kind === 'sink')
  const changes = { ...emptyChanges(), moved: { [base.id]: { center: [8, 11] as [number, number], facing: 0 } } }
  const moved = applyLayout(changes).furniture.find(piece => piece.id === base.id)!
  const movedSink = moved.components?.find(component => component.kind === 'sink')
  if (sink?.x === undefined || !movedSink) throw new Error('Missing sink coordinates')
  expect(movedSink.x).toBeCloseTo(8)
  expect(movedSink.y).toBeCloseTo(11 + sink.x - base.center[0])
})

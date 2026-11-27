import { expect, it } from 'vitest'
import { canPlace, duplicateSpot, moveWithCollision, pickPiece, rotationSpot } from './editing'
import { footprint, furnitureItems, vehicleItems } from './furniture'
import { pool, walkCollisionFor } from './house'
import { applyLayout, emptyChanges, GRID, rotate, snapToGrid } from './layout'
import { defaults } from './settings'

const sofa = furnitureItems.find(item => item.kind === 'sofa')!

it.each([...furnitureItems, ...vehicleItems])('allows the default placement of $id', item => {
  expect(canPlace(item)).toBe(true)
})

it('checks the entire item footprint and clamps a fast drag before a wall', () => {
  const item = { ...sofa, id: 'test', size: [0.4, 0.4, 0.5] as typeof sofa.size, center: [4.6, 4] as [number, number] }
  const target = [2.8, 4] as const
  expect(canPlace(item)).toBe(true)
  expect(canPlace({ ...item, center: [...target] })).toBe(true)
  expect(canPlace({ ...item, center: [3.8, 4] })).toBe(false)
  expect(canPlace({ ...item, center: [0.1, 4] })).toBe(false)
  const moved = moveWithCollision(item, target)
  expect(moved.center[0]).toBeLessThan(item.center[0])
  expect(moved.center[0]).toBeGreaterThan(4.02)
  expect(canPlace(moved)).toBe(true)
  expect(moveWithCollision(moved, target).center).toEqual(moved.center)
})

it('stops a sun lounger at the pool edge when dragged toward the water', () => {
  const item = furnitureItems.find(item => item.kind === 'sunLounger')!
  const target: typeof item.center = [pool.label[0], item.center[1]]
  const westEdge = Math.min(...pool.polygon.map(([x]) => x))
  const moved = moveWithCollision(item, target)
  const frontEdge = Math.max(...footprint(moved).map(([x]) => x))

  expect(canPlace({ ...item, center: target })).toBe(false)
  expect(moved.center[0]).toBeGreaterThan(item.center[0])
  expect(frontEdge).toBeGreaterThan(westEdge - GRID)
  expect(canPlace(moved)).toBe(true)
  expect(canPlace({ ...moved, center: [moved.center[0] + GRID, moved.center[1]] })).toBe(false)
  expect(moveWithCollision(moved, target).center).toEqual(moved.center)
})

it('nudges a wall-flush sofa to the nearest valid grid center when rotated by 15°', () => {
  const item = { ...sofa, id: 'wall-flush', center: [4.357, 4], facing: 0 } satisfies typeof sofa
  const facing = rotate(item.facing, 15)
  expect(canPlace(item)).toBe(true)
  expect(canPlace({ ...item, facing })).toBe(false)
  const center = rotationSpot(item, facing)
  expect(center).toEqual([4.65, 4])
  expect(center).toEqual(snapToGrid(center!))
  expect(canPlace({ ...item, center: center!, facing })).toBe(true)
})

it('rejects rotation when a wedged piece cannot be nudged clear within 60 cm', () => {
  const item = { ...sofa, id: 'wedged', center: [18.52, 5.36], size: [2.35, 1.65, 0.8], facing: 0 } satisfies typeof sofa
  expect(canPlace(item)).toBe(true)
  expect(rotationSpot(item, 15)).toBeUndefined()
})

it('duplicates from a wall-adjacent spot into a valid nearby spot', () => {
  const item = furnitureItems.find(item => item.kind === 'wardrobe')!
  const center = duplicateSpot(item)
  expect(center).toBeDefined()
  expect(center).not.toEqual(item.center)
  expect(canPlace({ ...item, id: 'copy', center: center! })).toBe(true)
})

it('picks a small raised piece over a larger piece and a rug', () => {
  const table = furnitureItems.find(item => item.kind === 'diningTable')!
  const pendant = furnitureItems.find(item => item.kind === 'linearPendant')!
  const rug = { ...table, kind: 'rug' as const, size: [0.05, 0.05, 0.01] as typeof table.size }
  expect(pickPiece([rug, table, pendant], table.center)).toBe(pendant)
})

it('keeps the default walking layout and moves the sofa collider with the delta', () => {
  const baseline = walkCollisionFor(defaults)
  const empty = emptyChanges()
  expect(applyLayout(empty)).toEqual({ furniture: furnitureItems, vehicles: vehicleItems, skipped: 0 })
  const unchanged = walkCollisionFor(defaults, empty)
  for (let x = 0; x < 31.5; x += 0.5) {
    for (let y = 0; y < 19; y += 0.5) expect(unchanged.isFree([x, y])).toBe(baseline.isFree([x, y]))
  }
  const changes = { ...empty, moved: { [sofa.id]: { center: [6.55, 6.65] as [number, number], facing: sofa.facing } } }
  const moved = walkCollisionFor(defaults, changes)
  expect(baseline.isFree(sofa.center)).toBe(false)
  expect(moved.isFree(sofa.center)).toBe(true)
  const destination = changes.moved[sofa.id].center
  expect(baseline.isFree(destination)).toBe(true)
  expect(moved.isFree(destination)).toBe(false)
  expect(walkCollisionFor(defaults, changes)).toBe(moved)
})

it('lets a wall-mounted item move away without allowing deeper penetration', () => {
  const mounted = { ...sofa, id: 'mounted', size: [0.3, 0.3, 0.1] as typeof sofa.size, center: [3.95, 4] as [number, number] }
  expect(canPlace(mounted)).toBe(false)
  expect(canPlace({ ...mounted, center: [3.9, 4] }, { reference: mounted })).toBe(false)
  const moved = moveWithCollision(mounted, [4.5, 4])
  expect(moved.center).toEqual([4.5, 4])
  expect(canPlace(moved)).toBe(true)
})

import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { Matrix4 } from 'three'
import { furnitureItems, vehicleItems, type FurnitureItem } from '../model/furniture'
import { buildFurnitureBatches } from './furnitureBatches'
import { placement } from './furnishingPlacement'
import { buildFurnitureGeometry, isProcedural } from './furnitureGeometry'

it('builds every procedural piece within the triangle budget', () => {
  let triangles = 0
  for (const item of furnitureItems.filter(isProcedural)) {
    const parts = buildFurnitureGeometry(item)
    expect(parts.length, item.id).toBeGreaterThan(0)
    for (const { geometry } of parts) {
      const { count, array } = geometry.getAttribute('position')
      expect(array.every(Number.isFinite), item.id).toBe(true)
      expect(count % 3, item.id).toBe(0)
      triangles += count / 3
      geometry.dispose()
    }
  }
  const models = glbBudget('furniture.glb', furnitureModels).triangles
  console.info(`Furniture set: ${triangles.toLocaleString('en-US')} procedural triangles, ${(triangles + models).toLocaleString('en-US')} including GLBs`)
  expect(triangles + models).toBeLessThan(120_000)
})

interface GlbManifest {
  nodes: { name: string; mesh?: number; children?: number[] }[]
  meshes: { primitives: { indices: number }[] }[]
  accessors: { count: number }[]
}

const furnitureModels = furnitureItems.filter(item => !isProcedural(item))

function glbBudget(file: string, items: FurnitureItem[]) {
  const glb = readFileSync(new URL(`../../public/models/${file}`, import.meta.url))
  const jsonLength = glb.readUInt32LE(12)
  const { nodes, meshes, accessors } = JSON.parse(glb.toString('utf8', 20, 20 + jsonLength)) as GlbManifest

  function primitives(index: number): { indices: number }[] {
    const { mesh, children = [] } = nodes[index]
    return [...(mesh === undefined ? [] : meshes[mesh].primitives), ...children.flatMap(primitives)]
  }

  return items.reduce((total, { kind }) => {
    const high = primitives(nodes.findIndex(node => node.name === kind))
    const lowIndex = nodes.findIndex(node => node.name === `${kind}_lod1`)
    const low = lowIndex === -1 ? [] : primitives(lowIndex)
    const triangles = (parts: typeof high) => parts.reduce((sum, part) => sum + accessors[part.indices].count / 3, 0)
    return {
      draws: total.draws + Math.max(high.length, low.length),
      triangles: total.triangles + Math.max(triangles(high), triangles(low)),
    }
  }, { draws: 0, triangles: 0 })
}

it('keeps the furniture and vehicle draw-call budgets in both styles', () => {
  const furniture = glbBudget('furniture.glb', furnitureModels).draws
  const vehicles = glbBudget('vehicles.glb', vehicleItems).draws
  const counts = [false, true].map(white => {
    const batches = buildFurnitureBatches(white)
    const draws = batches.length + furniture
    expect(draws).toBeLessThanOrEqual(60)
    expect(batches.filter(batch => batch.transforms?.length === 8).length).toBeGreaterThan(0)
    batches.forEach(batch => batch.geometry.dispose())
    return draws
  })
  expect(vehicles).toBeLessThanOrEqual(25)
  console.info(`Draw-call upper bounds: ${counts[0]} finished furniture, ${counts[1]} white furniture, ${vehicles} vehicles`)
})

it('mounts both shared bathroom fixtures on the east wall and extends them west over the tray', () => {
  const fixtures = furnitureItems.filter(item =>
    item.room === 'bathroom' && (item.kind === 'showerHead' || item.kind === 'showerMixer'))
  expect(fixtures).toHaveLength(2)
  for (const item of fixtures.filter(isProcedural)) {
    const { position, yaw } = placement(item)
    const transform = new Matrix4().makeRotationY(yaw).setPosition(...position)
    const [{ geometry }] = buildFurnitureGeometry(item)
    geometry.applyMatrix4(transform).computeBoundingBox()
    expect(geometry.boundingBox!.max.x).toBeGreaterThanOrEqual(9.997 - 1e-6)
    expect(geometry.boundingBox!.min.x).toBeLessThan(item.center[0])
    geometry.dispose()
  }
})

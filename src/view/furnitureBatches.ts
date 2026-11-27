import { BufferAttribute, Color, Matrix4, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { furnitureItems, type FurnitureItem } from '../model/furniture'
import { buildFurnitureGeometry, isProcedural, palette, type Finish, type ProceduralItem } from './furnitureGeometry'
import { placement } from './furnishingPlacement'

const shadowCasters = new Set<ProceduralItem['kind']>([
  'bedQueen', 'bedKing', 'sofa', 'outdoorSofa', 'diningTable', 'outdoorTable', 'coffeeTable',
  'wardrobe', 'laundryCabinet', 'kitchenBase', 'island', 'gourmetCounter', 'breakfastBar',
])

export type BatchFinish = Finish | 'matte' | 'white'

interface Batch {
  key: string
  finish: BatchFinish
  geometry: BufferGeometry
  castShadow: boolean
  transforms?: Matrix4[]
}

function transform(item: ProceduralItem, scaleRug: boolean) {
  const { position, yaw } = placement(item)
  const matrix = new Matrix4().makeRotationY(yaw).setPosition(...position)
  return scaleRug ? matrix.multiply(new Matrix4().makeScale(item.size[0], 1, item.size[1])) : matrix
}

function batchFinish(geometry: BufferGeometry, finish: Finish, white: boolean): BatchFinish {
  if (white) return 'white'
  if (Object.keys(palette[finish]).length > 1) return finish

  // The matte finishes differ only in color. Bake that color into the geometry
  // so a chair's oak frame and charcoal cushion share one instanced draw.
  const color = new Color(palette[finish].color)
  const colors = new BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 3), 3)
  for (let i = 0; i < colors.count; i++) colors.setXYZ(i, color.r, color.g, color.b)
  geometry.setAttribute('color', colors)
  return 'matte'
}

export function buildFurnitureBatches(white: boolean, items: FurnitureItem[] = furnitureItems): Batch[] {
  const groups = new Map<string, ProceduralItem[]>()
  for (const item of items.filter(isProcedural)) {
    const key = item.kind === 'rug' ? 'rug' : JSON.stringify([item.kind, item.size, item.components,
      item.kind === 'coffeeTable' && item.room])
    const group = groups.get(key) ?? []
    group.push(item)
    groups.set(key, group)
  }

  const batches = new Map<string, Omit<Batch, 'geometry'> & { parts: BufferGeometry[] }>()
  for (const [key, items] of groups) {
    const item = items[0]
    const rug = item.kind === 'rug'
    const castShadow = shadowCasters.has(item.kind)
    const transforms = items.map(item => transform(item, rug))
    const instanced = items.length > 1
    const parts = buildFurnitureGeometry(rug ? { ...item, size: [1, 1, item.size[2]] } : item)
    for (const { finish, geometry } of parts) {
      const material = batchFinish(geometry, finish, white)
      const batchKey = `${instanced ? key : 'static'}:${material}:${castShadow}`
      const batch = batches.get(batchKey) ?? {
        key: batchKey, finish: material, castShadow, parts: [], transforms: instanced ? transforms : undefined,
      }
      batch.parts.push(instanced ? geometry : geometry.applyMatrix4(transforms[0]))
      batches.set(batchKey, batch)
    }
  }

  return Array.from(batches.values(), ({ parts, ...batch }) => {
    if (parts.length === 1) return { ...batch, geometry: parts[0] }
    const geometry = mergeGeometries(parts)
    parts.forEach(part => part.dispose())
    return { ...batch, geometry }
  })
}

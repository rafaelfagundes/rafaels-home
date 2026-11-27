import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { MeshStandardMaterial, type BufferGeometry, type InstancedMesh, type Matrix4 } from 'three'
import type { FurnitureItem } from '../model/furniture'
import { effectiveLayout } from '../model/layout'
import { useLayout } from '../model/layoutStore'
import { useEditorPreview } from './editorPreview'
import { useApp } from '../model/store'
import FurnishingModels from './FurnishingModels'
import { buildFurnitureBatches, type BatchFinish } from './furnitureBatches'
import { isProcedural, palette } from './furnitureGeometry'
import { placement, useFurnishingShadows, whiteFurnishing } from './furnishingPlacement'

const materials = new Map<BatchFinish, MeshStandardMaterial>(Object.entries(palette).map(([finish, values]) =>
  [finish as BatchFinish, new MeshStandardMaterial({ roughness: 0.82, ...values })]))
materials.set('matte', new MeshStandardMaterial({ roughness: 0.82, vertexColors: true }))
materials.set('white', whiteFurnishing)
const ignoreRaycast = () => {}

function Instances({ transforms, geometry, material, castShadow }: {
  transforms: Matrix4[]
  geometry: BufferGeometry
  material: MeshStandardMaterial
  castShadow: boolean
}) {
  const mesh = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const object = mesh.current!
    transforms.forEach((matrix, index) => object.setMatrixAt(index, matrix))
    object.instanceMatrix.needsUpdate = true
    object.computeBoundingSphere()
  }, [transforms])
  return <instancedMesh ref={mesh} args={[geometry, material, transforms.length]}
    castShadow={castShadow} receiveShadow raycast={ignoreRaycast} />
}

function FurnitureBatches({ items, white, preview = false }: { items: FurnitureItem[]; white: boolean; preview?: boolean }) {
  const batches = useMemo(() => buildFurnitureBatches(white, items), [items, white])
  useFurnishingShadows(batches)
  useEffect(() => () => batches.forEach(batch => batch.geometry.dispose()), [batches])
  return batches.map(({ key, geometry, finish, castShadow, transforms }) => {
    const material = materials.get(finish)!
    return transforms
      ? <Instances key={key} transforms={transforms} geometry={geometry} material={material} castShadow={castShadow && !preview} />
      : <mesh key={key} geometry={geometry} material={material} castShadow={castShadow && !preview} receiveShadow raycast={ignoreRaycast} />
  })
}

function DraggedFurniture({ item, white }: { item: FurnitureItem; white: boolean }) {
  const preview = useEditorPreview(s => s.item?.id === item.id ? s.item : item)
  const [x, y, z] = placement(item).position
  const [a, b, c] = placement(preview).position
  const items = useMemo(() => [item], [item])
  return <group position={[a - x, b - y, c - z]}>
    {isProcedural(item) ? <FurnitureBatches items={items} white={white} preview /> :
      <FurnishingModels file="furniture.glb" items={items} white={white} />}
  </group>
}

export default function Furniture() {
  const white = useApp(s => s.settings.style === 'white')
  const night = useApp(s => s.settings.lighting === 'night')
  const changes = useLayout(s => s.changes)
  const draggedId = useLayout(s => s.dragging ? s.selection : null)
  const furniture = effectiveLayout(changes).furniture
  const dragged = furniture.find(item => item.id === draggedId)
  const items = useMemo(() => furniture.filter(item => item !== dragged), [furniture, dragged])
  useLayoutEffect(() => {
    materials.get('bulb')!.emissiveIntensity = night ? 0.8 : 0
    materials.get('indicator')!.emissiveIntensity = night ? 0.5 : 0
  }, [night])

  return <group name="Furniture">
    <FurnitureBatches items={items} white={white} />
    <FurnishingModels file="furniture.glb" items={items.filter(item => !isProcedural(item))} white={white} />
    {dragged && <DraggedFurniture item={dragged} white={white} />}
  </group>
}

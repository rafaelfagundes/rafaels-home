import { useLayoutEffect, useMemo, useRef } from 'react'
import { MeshStandardMaterial, type BufferGeometry, type InstancedMesh, type Matrix4 } from 'three'
import { furnitureItems } from '../model/furniture'
import { useApp } from '../model/store'
import FurnishingModels from './FurnishingModels'
import { buildFurnitureBatches, type BatchFinish } from './furnitureBatches'
import { isProcedural, palette } from './furnitureGeometry'
import { useFurnishingShadows, whiteFurnishing } from './furnishingPlacement'

const models = furnitureItems.filter(item => !isProcedural(item))
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

// These static batches are shared across toggle changes, like the architecture meshes.
const batchCache = new Map<boolean, ReturnType<typeof buildFurnitureBatches>>()

export default function Furniture() {
  const white = useApp(s => s.settings.style === 'white')
  const night = useApp(s => s.settings.lighting === 'night')
  const batches = useMemo(() => {
    const cached = batchCache.get(white) ?? buildFurnitureBatches(white)
    batchCache.set(white, cached)
    return cached
  }, [white])
  useFurnishingShadows()
  useLayoutEffect(() => {
    materials.get('bulb')!.emissiveIntensity = night ? 0.8 : 0
    materials.get('indicator')!.emissiveIntensity = night ? 0.5 : 0
  }, [night])

  return <group name="Furniture">
    {batches.map(({ key, geometry, finish, castShadow, transforms }) => {
      const material = materials.get(finish)!
      return transforms
        ? <Instances key={key} transforms={transforms} geometry={geometry} material={material} castShadow={castShadow} />
        : <mesh key={key} geometry={geometry} material={material} castShadow={castShadow} receiveShadow raycast={ignoreRaycast} />
    })}
    <FurnishingModels file="furniture.glb" items={models} white={white} />
  </group>
}

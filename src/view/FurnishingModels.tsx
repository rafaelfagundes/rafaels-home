import { Detailed, useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import { Box3, Mesh, MeshStandardMaterial, Vector3, type Object3D } from 'three'
import type { FurnitureItem } from '../model/furniture'
import { placement, useFurnishingShadows } from './furnishingPlacement'

export const whiteFurnishing = new MeshStandardMaterial({ color: '#f4f3ee', roughness: 0.9 })

const bounds = new WeakMap<Object3D, Vector3>()
const lodDistances = [0, 7]

function modelSize(node: Object3D) {
  let size = bounds.get(node)
  if (!size) {
    node.updateWorldMatrix(true, true)
    size = new Box3().setFromObject(node).getSize(new Vector3())
    bounds.set(node, size)
  }
  return size
}

function prepare(node: Object3D, white: boolean, castShadow: boolean) {
  const model = node.clone()
  model.traverse(object => {
    if (object instanceof Mesh) {
      if (white) object.material = whiteFurnishing
      object.castShadow = castShadow
      object.receiveShadow = true
      // Floor taps and Measure raycast against architecture.
      object.raycast = () => {}
    }
  })
  return model
}

function Model({ item, high, low, white, castShadow }: {
  item: FurnitureItem
  high: Object3D
  low?: Object3D
  white: boolean
  castShadow: boolean
}) {
  const models = useMemo(() => ({
    high: prepare(high, white, castShadow),
    low: low && prepare(low, white, castShadow),
  }), [high, low, white, castShadow])
  const { position, yaw } = placement(item)
  const { x, y, z } = modelSize(high)
  const [width, depth, height] = item.size
  const ratio = (target: number, source: number) => Math.abs(target - source) > 0.001 ? target / source : 1
  return <group position={position} rotation-y={yaw} scale={[ratio(width, x), ratio(height, y), ratio(depth, z)]}>
    {models.low ? <Detailed distances={lodDistances}>
      <primitive object={models.high} />
      <primitive object={models.low} />
    </Detailed> : <primitive object={models.high} />}
  </group>
}

export default function FurnishingModels({ file, items, white, castShadow = false }: {
  file: 'furniture.glb' | 'vehicles.glb'
  items: FurnitureItem[]
  white: boolean
  castShadow?: boolean
}) {
  const { nodes } = useGLTF(`${import.meta.env.BASE_URL}models/${file}`, false, true)
  useFurnishingShadows()
  return items.map(item => <Model key={item.id} item={item} high={nodes[item.kind]}
    low={nodes[`${item.kind}_lod1`]} white={white} castShadow={castShadow} />)
}

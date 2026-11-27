import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import { Light, MeshStandardMaterial } from 'three'
import type { FurnitureItem } from '../model/furniture'
import { floorElevation, planToWorld } from '../model/geometry'
import { walkingFloors } from '../model/house'

export const whiteFurnishing = new MeshStandardMaterial({ color: '#f4f3ee', roughness: 0.9 })

export function placement(item: FurnitureItem) {
  return {
    position: planToWorld(item.center, floorElevation(item.center, walkingFloors) + (item.elevation ?? 0)),
    yaw: (90 - item.facing) * Math.PI / 180,
  }
}

// The house caches its sun shadow map. Refresh it when asynchronous contents mount or leave.
export function useFurnishingShadows(placement?: object) {
  const scene = useThree(state => state.scene)
  useLayoutEffect(() => {
    const invalidate = () => scene.traverse(object => {
      if (object instanceof Light && object.shadow) object.shadow.needsUpdate = true
    })
    invalidate()
    return invalidate
  }, [placement, scene])
}

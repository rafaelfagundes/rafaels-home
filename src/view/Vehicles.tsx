import { vehicleItems } from '../model/furniture'
import { useApp } from '../model/store'
import FurnishingModels from './FurnishingModels'

export default function Vehicles() {
  const white = useApp(s => s.settings.style === 'white')
  return <group name="Vehicles">
    <FurnishingModels file="vehicles.glb" items={vehicleItems} white={white} castShadow />
  </group>
}

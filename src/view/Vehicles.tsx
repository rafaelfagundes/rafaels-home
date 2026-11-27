import { useMemo } from 'react'
import type { FurnitureItem } from '../model/furniture'
import { effectiveLayout } from '../model/layout'
import { useLayout } from '../model/layoutStore'
import { useEditorPreview } from './editorPreview'
import { useApp } from '../model/store'
import FurnishingModels from './FurnishingModels'

function DraggedVehicle({ item, white }: { item: FurnitureItem; white: boolean }) {
  const preview = useEditorPreview(s => s.item?.id === item.id ? s.item : item)
  return <FurnishingModels file="vehicles.glb" items={[preview]} white={white} />
}

export default function Vehicles() {
  const white = useApp(s => s.settings.style === 'white')
  const changes = useLayout(s => s.changes)
  const draggedId = useLayout(s => s.dragging ? s.selection : null)
  const vehicles = effectiveLayout(changes).vehicles
  const dragged = vehicles.find(item => item.id === draggedId)
  const items = useMemo(() => vehicles.filter(item => item !== dragged), [vehicles, dragged])
  return <group name="Vehicles">
    <FurnishingModels file="vehicles.glb" items={items} white={white} castShadow />
    {dragged && <DraggedVehicle item={dragged} white={white} />}
  </group>
}

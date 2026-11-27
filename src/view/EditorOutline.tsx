import { Edges } from '@react-three/drei'
import { useApp } from '../model/store'
import { useLayout } from '../model/layoutStore'
import { effectiveLayout } from '../model/layout'
import { palette } from '../model/palette'
import { PERSON_HEIGHT } from '../model/person'
import { floorElevation } from '../model/geometry'
import { walkingFloors } from '../model/house'
import { useEditorPreview } from './editorPreview'

export default function EditorOutline() {
  const { mode, measuring, panel, person, controlsHidden, settings } = useApp()
  const selection = useLayout(s => s.selection)
  const blocked = useLayout(s => s.blocked)
  const changes = useLayout(s => s.changes)
  const preview = useEditorPreview(s => s.item)
  if (!selection || mode !== 'dollhouse' || measuring || panel || controlsHidden) return null
  const { furniture, vehicles } = effectiveLayout(changes)
  const piece = (settings.furniture && furniture.find(item => item.id === selection)) ||
    (settings.vehicles && vehicles.find(item => item.id === selection))
  const item = selection === 'person'
    ? { center: person.position, facing: person.heading * 180 / Math.PI, size: [0.5, 0.5, PERSON_HEIGHT], elevation: 0 }
    : preview?.id === selection ? preview : piece
  if (!item) return null
  const [x, z] = item.center
  const [width, depth, height] = item.size
  const floor = floorElevation(item.center, walkingFloors)
  return <group position={[x, floor, z]} rotation-y={(90 - item.facing) * Math.PI / 180}>
    <mesh position-y={(item.elevation ?? 0) + height / 2} raycast={() => {}}>
      <boxGeometry args={[width + 0.02, height + 0.02, depth + 0.02]} />
      <meshBasicMaterial visible={false} />
      <Edges color={blocked ? palette['warning-red'] : palette.orange} lineWidth={2} toneMapped={false} fog={false} depthTest={false} renderOrder={15} />
    </mesh>
    {piece && <mesh position-y={0.025} rotation-x={-Math.PI / 2} raycast={() => {}} renderOrder={14}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial color={palette.orange} transparent opacity={0.25} depthWrite={false} toneMapped={false} fog={false} />
    </mesh>}
  </group>
}

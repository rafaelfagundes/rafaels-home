import { duplicateSpot, rotationSpot } from './editing'
import { effectiveLayout, rotate, snapToGrid } from './layout'
import { useLayout } from './layoutStore'
import { useApp } from './store'
import { safePosition, walkCollisionFor } from './house'
import type { Person } from './person'
import type { Point } from './geometry'

export function editorEnabled() {
  const { mode, panel, measuring, controlsHidden } = useApp.getState()
  return mode === 'dollhouse' && !panel && !measuring && !controlsHidden
}

export function visiblePieces() {
  const { furniture, vehicles } = effectiveLayout(useLayout.getState().changes)
  const settings = useApp.getState().settings
  return [...(settings.furniture ? furniture : []), ...(settings.vehicles ? vehicles : [])]
}

export function commitPerson(person: Person) {
  useApp.getState().setPose({ ...person, pitch: 0 })
  useLayout.getState().editPerson({ position: [...person.position], heading: person.heading })
}

export function moveEditorPerson(point: Point) {
  const app = useApp.getState()
  app.movePerson(snapToGrid(point))
  const { person } = useApp.getState()
  if (person === app.person) return
  const snapped = snapToGrid(person.position)
  const collision = walkCollisionFor(app.settings)
  const reached = safePosition(snapped, person.position, collision)
  const position = reached && Math.hypot(reached[0] - snapped[0], reached[1] - snapped[1]) < 1e-7 ? snapped : person.position
  commitPerson({ ...person, position })
}

let blockedTimer: ReturnType<typeof setTimeout> | undefined

function showBlocked() {
  clearTimeout(blockedTimer)
  useLayout.setState({ blocked: true })
  blockedTimer = setTimeout(() => useLayout.setState({ blocked: false }), 2000)
}

export function editSelection(action: -90 | -15 | 15 | 90 | 'duplicate' | 'remove' | 'done') {
  const { selection, dragging, changes, select, move, remove, add } = useLayout.getState()
  if (!editorEnabled() || !selection) return
  if (action === 'done') {
    select(null)
    return
  }
  if (dragging) return
  if (selection === 'person') {
    if (typeof action === 'number') {
      const person = useApp.getState().person
      commitPerson({ ...person, heading: rotate(person.heading * 180 / Math.PI, action) * Math.PI / 180 })
    }
    return
  }
  const item = visiblePieces().find(piece => piece.id === selection)
  if (!item) return
  if (action === 'remove') remove(selection)
  else if (action === 'duplicate') {
    const center = duplicateSpot(item)
    if (center) add(changes.added.find(copy => copy.id === selection)?.base ?? selection, { center, facing: item.facing })
    else showBlocked()
  } else {
    const facing = rotate(item.facing, action)
    const center = rotationSpot(item, facing)
    if (center) move(selection, { center, facing })
    else showBlocked()
  }
}

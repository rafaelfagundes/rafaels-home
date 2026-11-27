import { editorEnabled, moveEditorPerson, visiblePieces } from '../model/editorActions'
import { moveWithCollision, pickPiece } from '../model/editing'
import type { FurnitureItem } from '../model/furniture'
import type { Point } from '../model/geometry'
import { useLayout } from '../model/layoutStore'
import { useApp } from '../model/store'
import { useEditorPreview } from './editorPreview'

interface Hit {
  person: boolean
  floor?: Point
}

export function createEditorGesture(
  canvas: HTMLCanvasElement,
  orbit: { enabled: boolean } | null,
  pick: (event: PointerEvent) => Hit,
  project: (event: PointerEvent, center: Point) => Point | undefined,
) {
  const cursor = canvas.style.cursor
  let timer: ReturnType<typeof setTimeout> | undefined
  let quick: { pointer: number; x: number; y: number; begin: (long: boolean) => void } | undefined
  let drag: { pointer: number; floor: Point; offset: Point; item: FurnitureItem | undefined; x: number; y: number } | undefined
  function clearPending() {
    clearTimeout(timer)
    timer = undefined
    quick = undefined
  }

  function finish(commit = false) {
    clearPending()
    if (!drag) return
    const current = drag
    drag = undefined
    if (orbit) orbit.enabled = true
    canvas.style.cursor = cursor
    const state = useLayout.getState()
    if (commit && current.item && state.selection === current.item.id) {
      const { center, facing } = current.item
      const original = visiblePieces().find(piece => piece.id === current.item?.id)
      if (original && (original.center[0] !== center[0] || original.center[1] !== center[1])) {
        state.move(current.item.id, { center, facing })
      }
    }
    state.setDragging(false)
    useEditorPreview.setState({ item: null })
  }

  function down(event: PointerEvent) {
    if (!editorEnabled()) return
    const hit = pick(event)
    const selected = useLayout.getState().selection
    const pieces = hit.floor ? visiblePieces() : []
    const item = !hit.person && hit.floor
      ? pickPiece(pieces.filter(piece => piece.id === selected), hit.floor) ?? pickPiece(pieces, hit.floor)
      : undefined
    const id = hit.person ? 'person' : item?.id
    if (!id) return
    const center = item?.center ?? useApp.getState().person.position
    function begin(long: boolean) {
      clearPending()
      if (!id || !editorEnabled()) return
      const offset = project(event, center)
      if (!offset) return
      useLayout.getState().select(id)
      useLayout.getState().setDragging(true)
      drag = { pointer: event.pointerId, floor: center, offset: [center[0] - offset[0], center[1] - offset[1]],
        item, x: event.clientX, y: event.clientY }
      if (orbit) orbit.enabled = false
      canvas.style.cursor = 'grabbing'
      canvas.setPointerCapture(event.pointerId)
      if (long && navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(15)
    }

    if (hit.person || selected === id) quick = { pointer: event.pointerId, x: event.clientX, y: event.clientY, begin }
    timer = setTimeout(() => begin(true), 450)
  }

  function move(event: PointerEvent) {
    if (quick?.pointer === event.pointerId && Math.hypot(event.clientX - quick.x, event.clientY - quick.y) >= 3) quick.begin(false)
    if (drag?.pointer !== event.pointerId) return false
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 3) return true
    const point = project(event, drag.floor)
    if (!point) return true
    const target: Point = [point[0] + drag.offset[0], point[1] + drag.offset[1]]
    if (drag.item) {
      const next = moveWithCollision(drag.item, target)
      if (next.center[0] !== drag.item.center[0] || next.center[1] !== drag.item.center[1]) {
        drag.item = next
        useEditorPreview.setState({ item: next })
      }
    } else moveEditorPerson(target)
    return true
  }

  return { down, move, clearPending, finish, owns: (id: number) => drag?.pointer === id, active: () => !!drag, pending: () => timer !== undefined }
}

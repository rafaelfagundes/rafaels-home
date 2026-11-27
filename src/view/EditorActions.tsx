import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { editSelection } from '../model/editorActions'
import { dictionary } from '../model/i18n'
import { kindNames } from '../model/kindNames'
import { effectiveLayout } from '../model/layout'
import { useLayout } from '../model/layoutStore'
import { useApp } from '../model/store'
import { Icon } from './Icon'

function handleKey(event: KeyboardEvent) {
  if (event.target instanceof HTMLElement &&
      (event.target.isContentEditable || event.target.closest('input, textarea, select'))) return
  const key = event.key.toLowerCase()
  let action: Parameters<typeof editSelection>[0]
  if (event.altKey) return
  if (event.ctrlKey || event.metaKey) {
    if (key !== 'd' || event.repeat || useLayout.getState().selection === 'person') return
    action = 'duplicate'
  } else {
    switch (key) {
      case 'q': action = event.shiftKey ? -90 : -15; break
      case 'e': action = event.shiftKey ? 90 : 15; break
      case 'delete':
      case 'backspace': action = 'remove'; break
      case 'escape': action = 'done'; break
      default: return
    }
  }
  event.preventDefault()
  editSelection(action)
}

export default function EditorActions() {
  const [mode, measuring, panel, controlsHidden, settings, pose] = useApp(useShallow(s =>
    [s.mode, s.measuring, s.panel, s.controlsHidden, s.settings, s.person] as const))
  const t = dictionary[settings.language]
  const selection = useLayout(s => s.selection)
  const blocked = useLayout(s => s.blocked)
  const dragging = useLayout(s => s.dragging)
  const changes = useLayout(s => s.changes)
  const { furniture, vehicles } = effectiveLayout(changes)
  const person = selection === 'person'
  const item = (settings.furniture && furniture.find(piece => piece.id === selection)) ||
    (settings.vehicles && vehicles.find(piece => piece.id === selection))
  const label = person ? t.person : item && (kindNames[item.kind]?.[settings.language] ?? t.piece)
  const facing = person ? pose.heading * 180 / Math.PI : item ? item.facing : 0
  const angle = ((Math.round(facing) % 360) + 360) % 360
  const show = !!label && mode === 'dollhouse' && !measuring && !panel && !controlsHidden
  useEffect(() => {
    if (!show) return
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [show])
  if (!show) return null

  return <div className="editor-actions surface" role="group" aria-label={t.editorActions}>
    <span className="editor-selection">{label} · {angle}°</span>
    <div className="editor-buttons">
      {([
        [-90, t.rotateLeft90, 'rotateLeft'], [-15, t.rotateLeft15, null],
        [15, t.rotateRight15, null], [90, t.rotateRight90, 'rotateRight'],
        ...(!person ? [['duplicate', t.duplicate, 'duplicate'], ['remove', t.deleteLayout, 'trash']] as const : []),
        ['done', t.done, 'done'],
      ] as const).map(([action, title, icon]) => <button key={action} className="icon-button" aria-label={title} title={title}
        disabled={dragging && action !== 'done'} onClick={() => editSelection(action)}>
        {icon ? <Icon name={icon} /> : action === -15 ? '−15°' : '+15°'}
      </button>)}
    </div>
    <span className="editor-feedback" aria-live="polite">{blocked ? t.editorBlocked : ''}</span>
  </div>
}

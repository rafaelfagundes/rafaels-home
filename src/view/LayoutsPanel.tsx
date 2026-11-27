import { useRef, useState, type FormEvent } from 'react'
import { dictionary } from '../model/i18n'
import { applyLayout, DEFAULT_NAME, MAX_LAYOUT_BYTES, validName, type LayoutErrorCode } from '../model/layout'
import { useLayout } from '../model/layoutStore'
import { useApp } from '../model/store'

const errorKey = {
  json: 'layoutErrorJson', schema: 'layoutErrorSchema', newer: 'layoutErrorNewer', version: 'layoutErrorVersion',
  name: 'layoutErrorName', changes: 'layoutErrorChanges', outside: 'layoutErrorOutside', large: 'layoutErrorLarge',
} as const satisfies Record<LayoutErrorCode, keyof typeof dictionary.en>

export default function LayoutsPanel() {
  const t = dictionary[useApp(s => s.settings.language)]
  const state = useLayout()
  const { name, changes, person, saved } = state
  const selected = Object.hasOwn(saved, name) ? saved[name] : undefined
  const displayName = name === DEFAULT_NAME && !selected ? t.defaultLayout : name
  const dirty = selected
    ? JSON.stringify(selected.changes) !== JSON.stringify(changes) || JSON.stringify(selected.person) !== JSON.stringify(person)
    : Object.keys(changes.moved).length > 0 || changes.removed.length > 0 || changes.added.length > 0 || !!person || name !== DEFAULT_NAME
  const fileInput = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<{ rename?: string; value: string }>()
  const [error, setError] = useState<keyof typeof dictionary.en>()
  const [imported, setImported] = useState<{ name: string; skipped: number }>()
  const [confirm, setConfirm] = useState<{ name: string } | 'reset'>()

  function clearMessage() {
    setError(undefined)
    setImported(undefined)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    clearMessage()
    const trimmed = form.value.trim()
    if (!validName(trimmed)) { setError('layoutErrorName'); return }
    if ((form.rename ?? name) !== trimmed && Object.hasOwn(saved, trimmed)) {
      setError('layoutNameTaken')
      return
    }
    const ok = form.rename ? state.rename(form.rename, trimmed) : state.saveAs(trimmed)
    if (ok) setForm(undefined)
    else setError('layoutErrorLarge')
  }

  function download() {
    const layout = state.exportCurrent()
    const slug = layout.name.normalize('NFD').replace(/\p{Mark}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'layout'
    const url = URL.createObjectURL(new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `rafaels-house-layout-${slug}.json`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function importFile(file: File) {
    clearMessage()
    if (file.size > MAX_LAYOUT_BYTES) { setError('layoutErrorLarge'); return }
    try {
      const result = state.importFile(await file.text())
      if (!result.ok) setError(errorKey[result.error])
      else {
        setForm(undefined)
        setConfirm(undefined)
        setImported({ name: result.layout.name, skipped: applyLayout(result.layout.changes).skipped })
      }
    } catch {
      setError('layoutErrorRead')
    }
  }

  return <div className="layouts-panel">
    <p className="layouts-current"><strong>{displayName}</strong>{dirty && <span>{t.layoutUnsaved}</span>}</p>
    <p className="layouts-hint">{t.layoutHint}</p>
    {!!Object.keys(saved).length && <ul className="layouts-list">
      {Object.keys(saved).map(savedName => <li key={savedName}>
        <p className="layout-row-name"><strong>{savedName}</strong>{savedName === name && <span>{t.layoutActive}</span>}</p>
        <div className="layouts-buttons">
          <button disabled={savedName === name && !dirty} onClick={() => {
            state.switchTo(savedName); clearMessage(); setConfirm(undefined); setForm(undefined)
          }}>{t.switchLayout}</button>
          <button onClick={() => { clearMessage(); setConfirm(undefined); setForm({ rename: savedName, value: savedName }) }}>{t.renameLayout}</button>
          <button onClick={() => { clearMessage(); setForm(undefined); setConfirm({ name: savedName }) }}>{t.deleteLayout}</button>
        </div>
      </li>)}
    </ul>}
    <div className="layouts-buttons layouts-main-actions">
      <button onClick={() => { clearMessage(); setConfirm(undefined); setForm({ value: selected ? displayName : '' }) }}>{t.saveAs}</button>
      <button onClick={download}>{t.exportLayout}</button>
      <button onClick={() => fileInput.current?.click()}>{t.importLayout}</button>
      <button className="layout-danger" onClick={() => { clearMessage(); setForm(undefined); setConfirm('reset') }}>{t.resetLayout}</button>
      <input ref={fileInput} hidden type="file" accept="application/json,.json" aria-label={t.importLayout}
        onChange={event => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void importFile(file)
        }} />
    </div>
    {form && <form className="layout-form" onSubmit={submit}>
      <label>{t.layoutName}<input autoFocus value={form.value} maxLength={100}
        onChange={event => setForm({ ...form, value: event.target.value })} /></label>
      <div className="layouts-buttons">
        <button type="submit">{form.rename ? t.renameLayout : t.saveLayout}</button>
        <button type="button" onClick={() => { setForm(undefined); clearMessage() }}>{t.cancel}</button>
      </div>
    </form>}
    {confirm && <div className="layout-form">
      <p>{confirm === 'reset' ? t.confirmResetLayout : t.confirmDeleteLayout.replace('{name}', () => confirm.name)}</p>
      <div className="layouts-buttons">
        <button className="layout-danger" onClick={() => {
          if (confirm === 'reset') state.resetToDefault()
          else state.delete(confirm.name)
          setConfirm(undefined)
        }}>{confirm === 'reset' ? t.resetLayout : t.deleteLayout}</button>
        <button autoFocus onClick={() => setConfirm(undefined)}>{t.cancel}</button>
      </div>
    </div>}
    {error && <p className="layout-message layout-error" role="alert">{t[error]}</p>}
    {imported && <p className="layout-message layout-status" role="status">{t.layoutImported.replace('{name}', () => imported.name)}
      {imported.skipped > 0 && ' ' + (imported.skipped === 1 ? t.layoutSkippedOne : t.layoutSkippedMany.replace('{count}', String(imported.skipped)))}
    </p>}
  </div>
}

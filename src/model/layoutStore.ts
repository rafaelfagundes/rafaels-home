import { create } from 'zustand'
import {
  DEFAULT_NAME, defaultItems, emptyChanges, MAX_ADDED, MAX_LAYOUT_BYTES, parseLayoutFile, validName, validateLayoutFile,
  type LayoutChanges, type LayoutFile, type LayoutResult, type Placement,
} from './layout'

const CURRENT_KEY = 'rafaels-home:layout-current'
const SAVED_KEY = 'rafaels-home:layouts'
type LayoutPerson = LayoutFile['person']
type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>

interface LayoutState {
  changes: LayoutChanges
  person: LayoutPerson
  name: string
  saved: Record<string, LayoutFile>
  selection: string | null
  blocked: boolean
  dragging: boolean
  version: number
  activation: number
  select: (id: string | null) => void
  setDragging: (dragging: boolean) => void
  move: (id: string, placement: Placement) => void
  remove: (id: string) => void
  add: (base: string, placement: Placement) => void
  editPerson: (person: LayoutPerson) => void
  saveAs: (name: string) => boolean
  switchTo: (name: string) => void
  rename: (oldName: string, newName: string) => boolean
  delete: (name: string) => void
  resetToDefault: () => void
  exportCurrent: () => LayoutFile
  importFile: (text: string) => LayoutResult
}

function file(name: string, changes: LayoutChanges, person?: LayoutPerson): LayoutFile {
  return { schema: 'rafaels-house/layout', version: 1, name, savedAt: new Date().toISOString(), changes, person }
}

export function createLayoutStore(storage?: StorageAccess) {
  function read(key: string): unknown {
    try { return JSON.parse((storage ?? localStorage).getItem(key) ?? 'null') } catch { return null }
  }
  function write(key: string, value: unknown) {
    try { (storage ?? localStorage).setItem(key, JSON.stringify(value)) } catch { /* Session-only layout. */ }
  }
  const storedCurrent = read(CURRENT_KEY)
  const current = validateLayoutFile({ ...file(DEFAULT_NAME, emptyChanges()), ...(
    storedCurrent && typeof storedCurrent === 'object' ? storedCurrent : {}) }, false)
  const saved: Record<string, LayoutFile> = Object.create(null)
  const storedSaved = read(SAVED_KEY)
  if (storedSaved && typeof storedSaved === 'object' && !Array.isArray(storedSaved)) {
    for (const value of Object.values(storedSaved)) {
      const result = validateLayoutFile(value, false)
      if (result.ok) saved[result.layout.name] = result.layout
    }
  }

  const store = create<LayoutState>((set, get) => {
    function activate({ name, changes, person }: LayoutFile, saved = get().saved) {
      set(state => ({
        name, changes, person, saved, selection: null, blocked: false, dragging: false,
        version: state.version + 1, activation: state.activation + 1,
      }))
    }
    function update(changes: LayoutChanges, selection = get().selection) {
      const { name, person } = get()
      // Keep exported and persisted layouts within the same limits as imports.
      if (new TextEncoder().encode(JSON.stringify(file(name, changes, person), null, 2)).length + 1024 > MAX_LAYOUT_BYTES) return
      set(state => ({ changes, selection, blocked: false, version: state.version + 1 }))
    }
    return {
      changes: current.ok ? current.layout.changes : emptyChanges(),
      name: current.ok ? current.layout.name : DEFAULT_NAME,
      person: current.ok ? current.layout.person : undefined,
      saved, selection: null, blocked: false, dragging: false, version: 0, activation: 0,
      select: selection => { if (selection !== get().selection) set({ selection, blocked: false }) },
      setDragging: dragging => set({ dragging }),
      move: (id, placement) => {
        const { changes } = get()
        update(changes.added.some(item => item.id === id)
          ? { ...changes, added: changes.added.map(item => item.id === id ? { ...item, ...placement } : item) }
          : { ...changes, moved: { ...changes.moved, [id]: placement } })
      },
      remove: id => {
        if (id === 'person') return
        const { changes } = get()
        const moved = { ...changes.moved }
        delete moved[id]
        update(changes.added.some(item => item.id === id)
          ? { ...changes, added: changes.added.filter(item => item.id !== id) }
          : { ...changes, moved, removed: [...new Set([...changes.removed, id])] }, null)
      },
      add: (base, placement) => {
        const { changes } = get()
        if (changes.added.length >= MAX_ADDED || !defaultItems.has(base)) return
        const ids = new Set(changes.added.map(item => item.id))
        let n = changes.added.length + 1
        while (ids.has(`copy-${n}`)) n++
        const id = `copy-${n}`
        update({ ...changes, added: [...changes.added, { ...placement, id, base }] }, id)
      },
      editPerson: person => set({ person }),
      saveAs: rawName => {
        const name = rawName.trim()
        if (!validName(name)) return false
        const { changes, person, saved } = get()
        const layout = file(name, changes, person)
        if (!validateLayoutFile(layout, false).ok) return false
        set({ name, saved: { ...saved, [name]: layout } })
        return true
      },
      switchTo: name => {
        const { saved } = get()
        if (Object.hasOwn(saved, name)) activate(saved[name])
      },
      rename: (oldName, rawName) => {
        const newName = rawName.trim()
        const { saved, name } = get()
        if (!validName(newName) || !Object.hasOwn(saved, oldName)) return false
        if (oldName === newName) return true
        if (Object.hasOwn(saved, newName)) return false
        const next = { ...saved, [newName]: { ...saved[oldName], name: newName } }
        if (!validateLayoutFile(next[newName], false).ok) return false
        delete next[oldName]
        set({ saved: next, name: name === oldName ? newName : name })
        return true
      },
      delete: name => {
        const saved = { ...get().saved }
        delete saved[name]
        set({ saved })
      },
      resetToDefault: () => activate(file(DEFAULT_NAME, emptyChanges())),
      exportCurrent: () => {
        const { name, changes, person } = get()
        return file(name, changes, person)
      },
      importFile: text => {
        const result = parseLayoutFile(text)
        if (!result.ok) return result
        const { saved } = get()
        const original = result.layout.name
        let name = original
        for (let n = 2; Object.hasOwn(saved, name); n++) {
          const suffix = ` (${n})`
          name = original.slice(0, 100 - suffix.length) + suffix
        }
        const layout = { ...result.layout, name }
        const checked = validateLayoutFile(layout, false)
        if (!checked.ok) return checked
        activate(layout, { ...saved, [name]: layout })
        return { ok: true, layout }
      },
    }
  })

  let timer: ReturnType<typeof setTimeout> | undefined
  function flush() {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
    const { name, changes, person } = store.getState()
    write(CURRENT_KEY, { name, changes, person })
  }
  store.subscribe((state, previous) => {
    if (state.saved !== previous.saved) write(SAVED_KEY, state.saved)
    if (state.changes === previous.changes && state.name === previous.name && state.person === previous.person) return
    clearTimeout(timer)
    timer = setTimeout(flush, 300)
  })
  if (!storage && typeof window !== 'undefined') window.addEventListener('pagehide', flush)
  return store
}

export const useLayout = createLayoutStore()

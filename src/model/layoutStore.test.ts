import { afterEach, expect, it, vi } from 'vitest'
import { furnitureItems } from './furniture'
import { emptyChanges } from './layout'
import { createLayoutStore } from './layoutStore'

const currentKey = 'rafaels-home:layout-current'
const savedKey = 'rafaels-home:layouts'
const item = furnitureItems[0]
const placement = { center: [6, 4] as [number, number], facing: 90 }

function fakeStorage(initial: Record<string, string> = {}) {
  const contents = new Map(Object.entries(initial))
  return { getItem: (key: string) => contents.get(key) ?? null, setItem: (key: string, value: string) => { contents.set(key, value) } }
}

afterEach(() => vi.useRealTimers())

it('debounces autosave and reloads the current delta and optional person', () => {
  vi.useFakeTimers()
  const storage = fakeStorage()
  const store = createLayoutStore(storage)
  store.getState().move(item.id, placement)
  vi.advanceTimersByTime(240)
  store.getState().editPerson({ position: [3.75, 12.3], heading: Math.PI })
  vi.advanceTimersByTime(299)
  expect(storage.getItem(currentKey)).toBeNull()
  vi.advanceTimersByTime(1)
  const restored = createLayoutStore(storage).getState()
  expect(restored.changes.moved[item.id]).toEqual(placement)
  expect(restored.person?.heading).toBe(Math.PI)
  expect(store.getState().version).toBe(1)
})

it('saves, switches, renames and deletes named snapshots and resets the working layout', () => {
  vi.useFakeTimers()
  const storage = fakeStorage()
  const store = createLayoutStore(storage)
  store.getState().move(item.id, placement)
  expect(store.getState().saveAs('Weekend')).toBe(true)
  store.getState().resetToDefault()
  expect(store.getState()).toMatchObject({ name: 'Default', changes: emptyChanges(), selection: null, dragging: false })
  store.getState().switchTo('Weekend')
  expect(store.getState().changes.moved[item.id]).toEqual(placement)
  expect(store.getState().rename('Weekend', 'Holiday')).toBe(true)
  expect(store.getState().name).toBe('Holiday')
  expect(createLayoutStore(storage).getState().saved.Holiday.name).toBe('Holiday')
  store.getState().delete('Holiday')
  expect(JSON.parse(storage.getItem(savedKey)!)).toEqual({})
  expect(store.getState().changes.moved[item.id]).toEqual(placement)
})

it('recovers from corrupt or inaccessible storage', () => {
  const storage = fakeStorage({ [currentKey]: '{', [savedKey]: '{"bad":{"version":4}}' })
  expect(createLayoutStore(storage).getState()).toMatchObject({ changes: emptyChanges(), saved: {} })
  const inaccessible = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
  expect(createLayoutStore(inaccessible).getState().name).toBe('Default')
})

it('imports and activates copies with deduplicated names', () => {
  vi.useFakeTimers()
  const store = createLayoutStore(fakeStorage())
  store.getState().saveAs('Weekend')
  const text = JSON.stringify(store.getState().exportCurrent())
  expect(store.getState().importFile(text)).toMatchObject({ ok: true, layout: { name: 'Weekend (2)' } })
  expect(store.getState().importFile(text)).toMatchObject({ ok: true, layout: { name: 'Weekend (3)' } })
  expect(store.getState().name).toBe('Weekend (3)')
  expect(Object.keys(store.getState().saved)).toEqual(['Weekend', 'Weekend (2)', 'Weekend (3)'])
  expect(store.getState().importFile('bad')).toEqual({ ok: false, error: 'json' })
  expect(store.getState().name).toBe('Weekend (3)')
})

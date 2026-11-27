import raw from '../data/house.json'
import { furnitureItems, vehicleItems, type FurnitureItem } from './furniture'
import { contains, type Point } from './geometry'

export interface Placement {
  center: [number, number]
  facing: number
}

export interface LayoutChanges {
  moved: Record<string, Placement>
  removed: string[]
  added: (Placement & { id: string; base: string })[]
}

export interface LayoutFile {
  schema: 'rafaels-house/layout'
  version: 1
  name: string
  savedAt: string
  changes: LayoutChanges
  person?: { position: [number, number]; heading: number }
}

export type LayoutErrorCode = 'json' | 'schema' | 'newer' | 'version' | 'name' | 'changes' | 'outside' | 'large'
export type LayoutResult = { ok: true; layout: LayoutFile } | { ok: false; error: LayoutErrorCode; detail?: string }

export const GRID = 0.05
export const MAX_LAYOUT_BYTES = 200 * 1024
export const MAX_ADDED = 500
export const DEFAULT_NAME = 'Default'
const lot = { polygon: raw.lot.polygon as unknown as Point[] }

export const emptyChanges = (): LayoutChanges => ({ moved: {}, removed: [], added: [] })
export const snapToGrid = ([x, y]: Point): [number, number] => [Math.round(x * 20) / 20, Math.round(y * 20) / 20]
export const snapFacing = (degrees: number) => ((Math.round((degrees % 360) / 15) * 15 % 360) + 360) % 360
export const rotate = (facing: number, delta: -90 | -15 | 15 | 90) => snapFacing(facing + delta)

export const defaultItems = new Map([...furnitureItems, ...vehicleItems].map(item => [item.id, item]))
const vehicleIds = new Set(vehicleItems.map(item => item.id))

function place(item: FurnitureItem, { center, facing }: Placement, id = item.id): FurnitureItem {
  const angle = (facing - item.facing) * Math.PI / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const components = item.components?.map(component => {
    if (component.x === undefined && component.y === undefined) return component
    const x = (component.x ?? item.center[0]) - item.center[0]
    const y = (component.y ?? item.center[1]) - item.center[1]
    return { ...component, x: center[0] + x * cos - y * sin, y: center[1] + x * sin + y * cos }
  })
  return { ...item, id, center, facing, components }
}

export function applyLayout(changes: LayoutChanges) {
  const removed = new Set(changes.removed)
  const apply = (items: FurnitureItem[]) => items.filter(item => !removed.has(item.id)).map(item =>
    Object.hasOwn(changes.moved, item.id) ? place(item, changes.moved[item.id]) : item)
  const furniture = apply(furnitureItems)
  const vehicles = apply(vehicleItems)
  for (const added of changes.added) {
    const base = defaultItems.get(added.base)
    if (base) (vehicleIds.has(base.id) ? vehicles : furniture).push(place(base, added, added.id))
  }
  const skipped = new Set([...Object.keys(changes.moved), ...changes.removed].filter(id => !defaultItems.has(id))).size +
    changes.added.filter(item => !defaultItems.has(item.base)).length
  return { furniture, vehicles, skipped }
}

const effectiveCache = new WeakMap<LayoutChanges, ReturnType<typeof applyLayout>>()
export function effectiveLayout(changes: LayoutChanges) {
  let layout = effectiveCache.get(changes)
  if (!layout) {
    layout = applyLayout(changes)
    effectiveCache.set(changes, layout)
  }
  return layout
}

export function validName(name: string) {
  const trimmed = name.trim()
  return trimmed.length > 0 && trimmed.length <= 100 && !Array.from(name).some(character => {
    const code = character.charCodeAt(0)
    return code < 32 || code === 127
  })
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function pair(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && Number.isFinite(value[0]) && Number.isFinite(value[1])
}

function readPlacement(value: unknown): Placement | undefined {
  if (!record(value) || !pair(value.center) || typeof value.facing !== 'number' || !Number.isFinite(value.facing)) return
  return { center: value.center, facing: snapFacing(value.facing) }
}

// Imported positions are validated against the lot before and after normalization.
export function validateLayoutFile(value: unknown, snap = true): LayoutResult {
  if (!record(value) || value.schema !== 'rafaels-house/layout') return { ok: false, error: 'schema' }
  if (typeof value.version === 'number' && value.version > 1) return { ok: false, error: 'newer' }
  if (value.version !== 1) return { ok: false, error: 'version' }
  if (typeof value.name !== 'string' || !validName(value.name)) return { ok: false, error: 'name' }
  const { changes, savedAt } = value
  if (!record(changes) || !record(changes.moved) || !Array.isArray(changes.removed) ||
      !changes.removed.every(id => typeof id === 'string' && id) || !Array.isArray(changes.added) ||
      typeof savedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(savedAt) || !Number.isFinite(Date.parse(savedAt))) return { ok: false, error: 'changes' }
  if (changes.added.length > MAX_ADDED) return { ok: false, error: 'large' }
  try {
    if (new TextEncoder().encode(JSON.stringify(value, null, 2)).length > MAX_LAYOUT_BYTES) return { ok: false, error: 'large' }
  } catch {
    return { ok: false, error: 'changes' }
  }

  const result = emptyChanges()
  result.moved = Object.create(null)
  result.removed = [...new Set<string>(changes.removed)]
  const ids = new Set([...defaultItems.keys(), 'person'])
  const pending = Object.entries(changes.moved).map(([id, pose]) => ({ id, pose, base: undefined as string | undefined }))
  for (const item of changes.added) {
    if (!record(item) || typeof item.id !== 'string' || !item.id || ids.has(item.id) ||
        typeof item.base !== 'string' || !item.base) return { ok: false, error: 'changes' }
    ids.add(item.id)
    pending.push({ id: item.id, pose: item, base: item.base })
  }
  for (const { id, pose, base } of pending) {
    const placement = readPlacement(pose)
    if (!placement) return { ok: false, error: 'changes' }
    const center = snap ? snapToGrid(placement.center) : placement.center
    if (!contains(lot, placement.center) || !contains(lot, center)) return { ok: false, error: 'outside' }
    if (base) result.added.push({ id, base, ...placement, center })
    else result.moved[id] = { ...placement, center }
  }
  const layout: LayoutFile = { schema: 'rafaels-house/layout', version: 1, name: value.name.trim(), savedAt, changes: result }
  if (value.person !== undefined) {
    const { person } = value
    if (!record(person) || !pair(person.position) || typeof person.heading !== 'number' || !Number.isFinite(person.heading)) {
      return { ok: false, error: 'changes' }
    }
    const position = snap ? snapToGrid(person.position) : person.position
    if (!contains(lot, person.position) || !contains(lot, position)) return { ok: false, error: 'outside' }
    layout.person = { position, heading: person.heading }
  }
  return { ok: true, layout }
}

export function parseLayoutFile(text: string): LayoutResult {
  if (text.length > MAX_LAYOUT_BYTES || new TextEncoder().encode(text).length > MAX_LAYOUT_BYTES) return { ok: false, error: 'large' }
  try { return validateLayoutFile(JSON.parse(text)) } catch { return { ok: false, error: 'json' } }
}

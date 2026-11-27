import type { Point } from './geometry'

export const PERSON_HEIGHT = 1.70
export const EYE_HEIGHT = 1.58
export const PERSON_KEY = 'rafaels-home:person'
export const entryPosition: Point = [3.75, 12.3]

export interface Person {
  position: Point
  heading: number
}

export function loadPerson(isFree: (point: Point) => boolean, storage?: Pick<Storage, 'getItem'>): Person {
  try {
    const saved = JSON.parse((storage ?? localStorage).getItem(PERSON_KEY) ?? 'null')
    if (Array.isArray(saved?.position) && saved.position.length === 2 &&
      saved.position.every(Number.isFinite) && Number.isFinite(saved.heading) && isFree(saved.position)) {
      return { position: saved.position, heading: saved.heading }
    }
  } catch {
    // Storage may be unavailable or contain invalid JSON.
  }
  return { position: entryPosition, heading: 0 }
}

export function persistPerson(readPerson: () => Person) {
  let timer: ReturnType<typeof setTimeout> | undefined
  function flush() {
    if (timer === undefined) return
    clearTimeout(timer)
    timer = undefined
    try { localStorage.setItem(PERSON_KEY, JSON.stringify(readPerson())) } catch { /* Session-only position. */ }
  }
  if (typeof window !== 'undefined') window.addEventListener('pagehide', flush)
  return () => { timer ??= setTimeout(flush, 500) }
}

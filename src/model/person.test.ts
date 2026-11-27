import { afterEach, describe, expect, it, vi } from 'vitest'
import { house, walkCollisionFor } from './house'
import { EYE_HEIGHT, entryPosition, loadPerson, PERSON_HEIGHT, PERSON_KEY, persistPerson, type Person } from './person'
import { defaults, SETTINGS_KEY } from './settings'

const savedPerson: Person = { position: [3.75, 12.3], heading: 1 }
const walk = walkCollisionFor(defaults)

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('person', () => {
  it('uses a 1.58 m eye height for a 1.70 m mannequin', () => {
    expect(house.meta.eyeHeight).toBe(EYE_HEIGHT)
    expect(EYE_HEIGHT).toBe(1.58)
    expect(PERSON_HEIGHT).toBe(1.70)
  })

  it.each([
    null, '{}', '{invalid', '{"position":[3.75,12.3,0],"heading":0}',
    '{"position":[3.75,12.3],"heading":"1"}', '{"position":[1e999,12.3],"heading":0}',
    '{"position":[20,13],"heading":0}', '{"position":[5.40,4.437],"heading":0}',
  ])('falls back to the entry for %s', value => {
    expect(loadPerson(walk.isFree, { getItem: () => value })).toEqual({ position: entryPosition, heading: 0 })
  })

  it('persists the latest pose at most twice per second', () => {
    vi.useFakeTimers()
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null,
      setItem: vi.fn((key: string, value: string) => values.set(key, value)) }
    vi.stubGlobal('localStorage', storage)
    let person = savedPerson
    const scheduleSave = persistPerson(() => person)
    for (let frame = 0; frame < 60; frame++) {
      person = { ...person, heading: frame }
      scheduleSave()
      vi.advanceTimersByTime(17)
    }
    expect(storage.setItem).toHaveBeenCalledTimes(2)
    expect(loadPerson(walk.isFree, storage)).toEqual(person)
  })

  it('enters Walk at the dollhouse person and keeps the pose when returning', async () => {
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === PERSON_KEY ? JSON.stringify(savedPerson) : null })
    const { useApp } = await import('./store')
    expect(useApp.getState()).toMatchObject({ person: savedPerson, mode: 'dollhouse', panel: 'help' })
    useApp.getState().movePerson([3.95, 12.3])
    const person = useApp.getState().person
    expect(person.position[0]).toBeCloseTo(3.95)
    expect(person.position[1]).toBe(12.3)
    expect(person.heading).toBe(0)
    useApp.getState().setMode('walk')
    expect(useApp.getState().pose).toEqual({ ...person, pitch: 0 })
    const pose = { position: entryPosition, heading: 2, pitch: 0.3 }
    useApp.getState().setPose(pose)
    useApp.getState().setMode('dollhouse')
    expect(useApp.getState().person).toEqual({ position: entryPosition, heading: 2 })
    useApp.getState().setMode('walk')
    expect(useApp.getState().pose).toEqual({ ...pose, pitch: 0 })
    useApp.getState().jump(person.position, 1)
    expect(useApp.getState().person).toEqual({ position: person.position, heading: 1 })
  })

  it.each([
    ['dollhouse', '?at=3.75,12.3,90,10', 'walk', Math.PI / 2],
    ['walk', '?at=20,13,0', 'walk', 1],
    ['dollhouse', '?at=20,13,0', 'dollhouse', 1],
  ])('honours start view %s and link %s', async (startView, search, mode, heading) => {
    vi.useFakeTimers()
    vi.stubGlobal('window', { location: { search }, addEventListener: vi.fn() })
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => key === SETTINGS_KEY ? JSON.stringify({ startView }) : JSON.stringify(savedPerson),
    })
    const { useApp } = await import('./store')
    expect(useApp.getState()).toMatchObject({ mode, person: { position: entryPosition, heading } })
  })
})

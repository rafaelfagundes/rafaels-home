import { describe, expect, it } from 'vitest'
import { dictionary, roomName } from './i18n'
import { defaults, loadSettings, saveSettings } from './settings'
import { formatArea, formatLength } from './units'

describe('units', () => {
  it.each([
    [1, '3′ 3″'], [0.3048, '1′ 0″'], [3.6576, '12′ 0″'],
    [11.6 * 0.0254, '1′ 0″'], [-1, '−3′ 3″'], [0, '0′ 0″'],
  ])('formats %s metres in feet and inches', (meters, expected) => {
    expect(formatLength(meters, 'imperial')).toBe(expected)
  })

  it('formats areas and metric decimals', () => {
    expect(formatArea(10, 'imperial')).toBe('108 sq ft')
    expect(formatLength(0.85, 'metric')).toBe('0.85 m')
    expect(formatLength(3.75, 'metric', 'pt-BR')).toBe('3,75 m')
    expect(formatArea(13.5, 'metric', 'pt-BR')).toBe('13,5 m²')
  })
})

describe('translations', () => {
  it('has the same keys in both languages', () => {
    expect(Object.keys(dictionary.en).sort()).toEqual(Object.keys(dictionary['pt-BR']).sort())
  })

  it('translates known rooms and falls back to the blueprint label', () => {
    expect(roomName({ key: 'living', namePt: 'Sala de Estar' }, 'en')).toBe('Living Room')
    expect(roomName({ key: 'living', namePt: 'Sala de Estar' }, 'pt-BR')).toBe('Sala de Estar')
    expect(roomName({ key: 'gourmet', namePt: 'Espaço gourmet' }, 'en')).toBe('Gourmet Area / Outdoor Kitchen')
    expect(roomName({ key: 'unknown', namePt: 'Outro' }, 'en')).toBe('Outro')
  })
})

describe('persisted settings', () => {
  function memoryStore(initial: string | null = null) {
    let value = initial
    return { getItem: () => value, setItem: (_key: string, next: string) => { value = next } }
  }

  it('defaults to English, Imperial, finished daylight, a hidden dollhouse roof, and enabled furniture and vehicles', () => {
    expect(loadSettings(memoryStore())).toEqual({ language: 'en', units: 'imperial', labels: true, shadows: 'low', style: 'finished', lighting: 'day', roofInDollhouse: false, furniture: true, vehicles: true })
  })

  it('round-trips all fields', () => {
    const storage = memoryStore()
    const settings = { language: 'pt-BR', units: 'metric', labels: false, shadows: 'high', style: 'white', lighting: 'night', roofInDollhouse: true, furniture: false, vehicles: false } as const
    saveSettings(settings, storage)
    expect(loadSettings(storage)).toEqual(settings)
  })

  it('preserves old preferences and supplies the new fields', () => {
    expect(loadSettings(memoryStore('{"language":"pt-BR","units":"metric","labels":false,"shadows":"off","style":"white","lighting":"night","roofInDollhouse":true}'))).toEqual({
      ...defaults, language: 'pt-BR', units: 'metric', labels: false, shadows: 'off', style: 'white', lighting: 'night', roofInDollhouse: true,
      furniture: true, vehicles: true,
    })
  })

  it('recovers from corrupt data and blocked storage', () => {
    expect(loadSettings(memoryStore('{invalid'))).toEqual(defaults)
    expect(loadSettings(memoryStore('{"units":"other","shadows":42,"style":"other","lighting":false,"roofInDollhouse":"true","furniture":0,"vehicles":null}'))).toEqual(defaults)
    expect(loadSettings({ ...memoryStore(), getItem: () => { throw new Error('blocked') } })).toEqual(defaults)
  })
})

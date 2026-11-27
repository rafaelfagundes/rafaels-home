import type { Language } from './i18n'
import type { Units } from './units'

export interface Settings {
  style: 'finished' | 'white'
  lighting: 'day' | 'night'
  roofInDollhouse: boolean
  furniture: boolean
  vehicles: boolean
  language: Language
  units: Units
  labels: boolean
  shadows: 'off' | 'low' | 'high'
}
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>
export const SETTINGS_KEY = 'rafaels-home:settings'
const HELP_KEY = 'rafaels-home:help-seen'
export const defaults: Settings = { language: 'en', units: 'imperial', labels: true, shadows: 'low', style: 'finished', lighting: 'day', roofInDollhouse: false, furniture: true, vehicles: true }

export function loadSettings(storage?: Storage): Settings {
  try {
    const saved = JSON.parse((storage ?? localStorage).getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings> | null
    return {
      style: saved?.style === 'white' ? 'white' : defaults.style,
      lighting: saved?.lighting === 'night' ? 'night' : defaults.lighting,
      roofInDollhouse: typeof saved?.roofInDollhouse === 'boolean' ? saved.roofInDollhouse : defaults.roofInDollhouse,
      furniture: typeof saved?.furniture === 'boolean' ? saved.furniture : defaults.furniture,
      vehicles: typeof saved?.vehicles === 'boolean' ? saved.vehicles : defaults.vehicles,
      language: saved?.language === 'pt-BR' ? 'pt-BR' : defaults.language,
      units: saved?.units === 'metric' ? 'metric' : defaults.units,
      labels: typeof saved?.labels === 'boolean' ? saved.labels : defaults.labels,
      shadows: saved?.shadows === 'off' || saved?.shadows === 'high' ? saved.shadows : defaults.shadows,
    }
  } catch {
    return { ...defaults }
  }
}

export function saveSettings(settings: Settings, storage?: Storage) {
  try {
    (storage ?? localStorage).setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Private sessions can restrict storage.
  }
}

export function helpSeen() {
  try { return localStorage.getItem(HELP_KEY) === '1' } catch { return false }
}

export function rememberHelp() {
  try { localStorage.setItem(HELP_KEY, '1') } catch { /* Session-only dismissal. */ }
}

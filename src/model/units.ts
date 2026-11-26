import type { Language } from './i18n'

export type Units = 'imperial' | 'metric'

export function formatLength(meters: number, units: Units, locale: Language = 'en') {
  if (units === 'metric') return `${meters.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`
  const inches = Math.round(Math.abs(meters) / 0.0254)
  return `${meters < 0 && inches ? '−' : ''}${Math.floor(inches / 12)}′ ${inches % 12}″`
}

export function formatArea(squareMeters: number, units: Units, locale: Language = 'en') {
  if (units === 'imperial') return `${(squareMeters / 0.09290304).toLocaleString(locale, { maximumFractionDigits: 0 })} sq ft`
  return `${squareMeters.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m²`
}

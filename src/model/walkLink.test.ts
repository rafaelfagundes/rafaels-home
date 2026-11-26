import { afterEach, describe, expect, it, vi } from 'vitest'
import { pool } from './house'
import { parseWalkLink } from './walkLink'

describe('parseWalkLink', () => {
  it('parses plan metres and defaults to level pitch', () => {
    expect(parseWalkLink('?stats&at=3.75%2C12.3%2C90')).toEqual({
      position: [3.75, 12.3], heading: Math.PI / 2, pitch: 0,
    })
  })

  it('converts signed angles and wraps full turns', () => {
    expect(parseWalkLink('?at=3.75,12.3,-450,30')).toEqual({
      position: [3.75, 12.3], heading: -Math.PI / 2, pitch: Math.PI / 6,
    })
  })

  it.each([
    '?stats', '?at=', '?at=1,2', '?at=1,2,3,4,5', '?at=1,2,3,',
    '?at=1,,3', '?at=1,2,3deg', '?at=0x1,2,3', '?at=1,2,NaN',
    '?at=1,2,Infinity', '?at=1e999,2,3', '?at=1,2,3,91',
  ])('ignores invalid input %s', search => {
    expect(parseWalkLink(search)).toBeUndefined()
  })
})

describe('walk startup', () => {
  afterEach(() => vi.unstubAllGlobals())

  async function startAt(search: string) {
    vi.resetModules()
    vi.stubGlobal('window', { location: { search } })
    vi.stubGlobal('localStorage', { getItem: () => null })
    const { useApp } = await import('./store')
    return useApp.getState()
  }

  it('starts in walk mode at a clear linked pose with help closed', async () => {
    const search = '?at=3.75,12.3,90,10'
    const { mode, panel, pose } = await startAt(search)
    expect(mode).toBe('walk')
    expect(panel).toBeNull()
    expect(pose).toEqual(parseWalkLink(search))
  })

  it.each([pool.label, [-1, -1] as const])('keeps the default start for blocked points (%s, %s)', async (x, y) => {
    const { panel, pose } = await startAt(`?at=${x},${y},90,10`)
    expect(panel).toBe('help')
    expect(pose).toEqual({ position: [3.75, 12.3], heading: 0, pitch: 0 })
  })
})

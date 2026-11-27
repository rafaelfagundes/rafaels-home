import { describe, expect, it } from 'vitest'
import { PERSON_HEIGHT } from '../model/person'
import { buildPersonGeometry } from './Person'

describe('person geometry', () => {
  it('stands on the floor at exactly 1.70 m within the triangle budget', () => {
    const geometry = buildPersonGeometry()
    geometry.computeBoundingBox()
    expect(geometry.boundingBox?.min.y).toBeCloseTo(0, 7)
    expect(geometry.boundingBox?.max.y).toBeCloseTo(PERSON_HEIGHT, 7)
    expect(geometry.index!.count / 3).toBeLessThan(3000)
    geometry.dispose()
  })
})

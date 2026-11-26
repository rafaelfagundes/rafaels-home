import { describe, expect, it } from 'vitest'
import { house } from '../model/house'
import { finishedLayers, whiteEave } from './finishedModel'

describe('finished geometry', () => {
  it('merges every material batch with finite positions, normals and UVs', () => {
    for (const { part, finish, geometry } of finishedLayers) {
      for (const attribute of ['position', 'normal', 'uv']) {
        const buffer = geometry.getAttribute(attribute)
        expect(buffer.count, `${part}/${finish}/${attribute}`).toBeGreaterThan(0)
        expect(buffer.array.every(Number.isFinite), `${part}/${finish}/${attribute}`).toBe(true)
      }
    }
  })

  it('places the downward-facing soffit under the roof slab and offsets the fascia', () => {
    const { top, slabThickness, fasciaHeight } = house.roof
    const soffit = finishedLayers.find(layer => layer.part === 'eave' && layer.finish === 'ceilingWood')!.geometry
    const fascia = finishedLayers.find(layer => layer.part === 'eave' && layer.finish === 'blackMetal')!.geometry
    soffit.computeBoundingBox()
    fascia.computeBoundingBox()
    whiteEave.computeBoundingBox()
    expect(soffit.boundingBox!.max.y).toBeCloseTo(top - slabThickness)
    expect(soffit.getAttribute('normal').getY(0)).toBeCloseTo(-1)
    expect(fascia.boundingBox!.min.y).toBeCloseTo(top - fasciaHeight)
    expect(fascia.boundingBox!.min.x).toBeCloseTo(whiteEave.boundingBox!.min.x - 0.04)
    expect(fascia.boundingBox!.max.y).toBeCloseTo(top)
  })
})

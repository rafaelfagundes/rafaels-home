import { describe, expect, it } from 'vitest'
import { rectangle, segments } from './geometry'
import { house } from './house'
import { classifyWallFace, outwardNormals } from './wallFinishes'

describe('wall finishes', () => {
  const wall = { polygon: rectangle([0, 0, 2, 0.2]) }
  const room = { polygon: rectangle([0, 0.2, 2, 3]), indoor: true, key: 'bedroom' }

  it('samples the room outward from the face and distinguishes the opposite exterior face', () => {
    expect(classifyWallFace(wall, [2, 0.2], [0, 0.2], [0, 1], [room])).toBe('plaster')
    expect(classifyWallFace(wall, [0, 0], [2, 0], [0, -1], [room])).toBe('stucco')
    expect(classifyWallFace(wall, [2, 0.2], [0, 0.2], [0, 1], [{ ...room, key: 'powder_room' }])).toBe('stoneTile')
  })

  it('uses stacked stone for exterior pillars and small wall footprints', () => {
    const smallWall = { polygon: rectangle([0, 0, 1, 0.2]) }
    expect(classifyWallFace({ ...wall, kind: 'pillar' }, [0, 0], [2, 0], [0, -1], [])).toBe('stackedStone')
    expect(classifyWallFace(smallWall, [0, 0], [1, 0], [0, -1], [])).toBe('stackedStone')
  })

  it('identifies the extracted north wall facing the living and dining rooms', () => {
    for (const id of ['w01', 'w07']) {
      const wall = house.walls.find(wall => wall.id === id)!
      const normals = outwardNormals(wall.polygon)
      const edgeIndex = segments(wall.polygon).findIndex(([a, b], i) =>
        a[1] === 5.622 && b[1] === 5.622 && normals[i][1] > 0.9)
      const [a, b] = segments(wall.polygon)[edgeIndex]
      expect(classifyWallFace(wall, a, b, normals[edgeIndex], house.rooms)).toBe('feature')
    }
  })
})

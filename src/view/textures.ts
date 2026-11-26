import { CanvasTexture, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from 'three'

interface Pattern {
  color: string
  size: [number, number]
  roughness?: number
  boards?: number
  tiles?: [number, number]
  stone?: boolean
}

export const patterns = {
  plaster: { color: '#ece6dc', size: [1.2, 1.2] },
  stoneTile: { color: '#d8d2c6', size: [1.2, 1.2], tiles: [2, 2] },
  feature: { color: '#3a3836', size: [1.2, 1.2] },
  stucco: { color: '#3b3c3d', size: [1.2, 1.2] },
  stackedStone: { color: '#a69a88', size: [1.2, 0.96], stone: true },
  cladding: { color: '#4a3426', size: [1.12, 1.8], boards: 8 },
  boundary: { color: '#b9b6ae', size: [1.2, 1.2] },
  concrete: { color: '#bdbab4', size: [1.6, 1.6], roughness: 0.35 },
  pavers: { color: '#cfcac0', size: [1.2, 1.2], tiles: [1, 2] },
  waterRipple: { color: '#3fa3d6', size: [2.4, 2.4] },
  poolTile: { color: '#1f2a30', size: [0.6, 0.6], tiles: [4, 4] },
  darkPavers: { color: '#b4afa6', size: [1.2, 1.2], tiles: [1, 2] },
  garage: { color: '#a9a6a0', size: [1.6, 1.6] },
  deck: { color: '#8a7a66', size: [1.12, 1.8], boards: 8 },
  lawn: { color: '#8f9d6e', size: [1.2, 1.2] },
  ceilingWood: { color: '#b18962', size: [0.96, 1.8], boards: 8 },
  beam: { color: '#96948f', size: [1.2, 1.2] },
} satisfies Record<string, Pattern>

export type PatternName = keyof typeof patterns
const textures = new Map<PatternName, CanvasTexture | null>()
const wave = (turns: number) => Math.sin(turns * Math.PI * 2)
const fraction = (value: number) => value - Math.floor(value)
const noise = (x: number, y: number) => fraction(Math.sin(x * 127.1 + y * 311.7) * 43758.5453)

export function getTexture(name: PatternName) {
  const cached = textures.get(name)
  if (cached !== undefined) return cached

  const pattern: Pattern = patterns[name]
  const canvas = document.createElement('canvas')
  const size = 256
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) {
    textures.set(name, null)
    return null
  }
  const rgb = [1, 3, 5].map(offset => parseInt(pattern.color.slice(offset, offset + 2), 16))
  const image = context.createImageData(size, size)
  const strength = name === 'plaster' ? 0.35 : 1
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size
      const v = y / size
      let shade = 1 + strength * ((noise(x, y) - 0.5) * 0.09 + wave(u * 3 + v * 2) * wave(v * 5 - u) * 0.035)
      if (name === 'waterRipple') shade += wave(u * 5 + v * 3 + wave(v * 2) * 0.45) * 0.055
      if (pattern.boards) {
        const board = Math.floor(u * pattern.boards)
        shade += (noise(board, 7) - 0.5) * 0.13 + wave(u * 92 + wave(v * 2 + board) * 0.22) * 0.035
        if (fraction(u * pattern.boards) < 0.055) shade *= 0.64
      }
      if (pattern.tiles) {
        const [columns, rows] = pattern.tiles
        if (fraction(u * columns) < 0.008 || fraction(v * rows) < 0.014) shade *= 0.78
      }
      if (pattern.stone) {
        const course = Math.floor(v * 10)
        const count = 3 + Math.floor(noise(course, 1) * 4)
        const along = u * count + noise(course, 2)
        const stone = Math.floor(along) % count
        shade += (noise(stone, course) - 0.5) * 0.27
        if (fraction(v * 10) < 0.075 + wave(u * 4 + course) * 0.02 || fraction(along) < 0.036) shade *= 0.72
      }
      const index = (y * size + x) * 4
      for (let channel = 0; channel < 3; channel++) image.data[index + channel] = rgb[channel] * shade
      image.data[index + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  const texture = new CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.minFilter = LinearMipmapLinearFilter
  texture.colorSpace = SRGBColorSpace
  texture.repeat.set(1 / pattern.size[0], 1 / pattern.size[1])
  textures.set(name, texture)
  return texture
}

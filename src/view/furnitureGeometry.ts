import {
  BoxGeometry, CylinderGeometry, ExtrudeGeometry, LatheGeometry, Shape, Vector2, type BufferGeometry,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { FurnitureItem } from '../model/furniture'

export const palette = {
  oak: { color: '#c8a77e' },
  linen: { color: '#d8d2c8' },
  fabric: { color: '#9d968c' },
  charcoal: { color: '#3a3c3f' },
  bedding: { color: '#f2efe9' },
  metal: { color: '#1b1b1b', roughness: 0.5, metalness: 0.6 },
  quartz: { color: '#eeebe6', roughness: 0.35 },
  steel: { color: '#b9bcbf', metalness: 0.8, roughness: 0.3 },
  teak: { color: '#8a5a3b' },
  wool: { color: '#cfc6b8' },
  glass: { color: '#b5d7d8', transparent: true, opacity: 0.2, roughness: 0.05, depthWrite: false },
  screen: { color: '#161a1e', roughness: 0.24 },
  mirror: { color: '#a9bac1', roughness: 0.12, metalness: 0.25 },
  bulb: { color: '#f2efe9', emissive: '#ffdb9d', emissiveIntensity: 0 },
  indicator: { color: '#637a65', emissive: '#a1ffb5', emissiveIntensity: 0 },
} as const

export type Finish = keyof typeof palette
export const furnitureModelKinds = ['fridge', 'washer', 'dryer', 'toilet', 'armchair', 'loungechair', 'plant'] as const
export type FurnitureModelKind = typeof furnitureModelKinds[number]
type ProceduralKind = Exclude<FurnitureItem['kind'], FurnitureModelKind | 'bmw_x5' | 'golf_r' | 'hayabusa'>
export type ProceduralItem = FurnitureItem & { kind: ProceduralKind }

export function isProcedural(item: FurnitureItem): item is ProceduralItem {
  return !furnitureModelKinds.some(kind => kind === item.kind)
    && item.kind !== 'bmw_x5' && item.kind !== 'golf_r' && item.kind !== 'hayabusa'
}

// Builders work in metres with the floor at y = 0 and the front toward +z.
class Piece {
  private parts = new Map<Finish, BufferGeometry[]>()

  constructor(readonly item: ProceduralItem) {}

  get w() { return this.item.size[0] }
  get d() { return this.item.size[1] }
  get h() { return this.item.size[2] }

  add(finish: Finish, geometry: BufferGeometry, x: number, y: number, z: number, tilt = 0) {
    const part = geometry.index ? geometry.toNonIndexed() : geometry
    if (part !== geometry) geometry.dispose()
    part.rotateX(tilt).translate(x, y, z)
    const geometries = this.parts.get(finish) ?? []
    geometries.push(part)
    this.parts.set(finish, geometries)
  }

  box(finish: Finish, w: number, h: number, d: number, x: number, y: number, z: number, radius = 0, tilt = 0) {
    this.add(finish, radius ? new RoundedBoxGeometry(w, h, d, 1, radius) : new BoxGeometry(w, h, d), x, y, z, tilt)
  }

  cylinder(finish: Finish, top: number, bottom: number, height: number, x: number, y: number, z: number, tilt = 0) {
    this.add(finish, new CylinderGeometry(top, bottom, height, 12), x, y, z, tilt)
  }

  lathe(finish: Finish, profile: [number, number][], x: number, y: number, z: number) {
    this.add(finish, new LatheGeometry(profile.map(([r, height]) => new Vector2(r, height)), 20), x, y, z)
  }

  legs(finish: Finish, height: number, inset = 0.055, radius = 0.025) {
    for (const x of [-this.w / 2 + inset, this.w / 2 - inset]) {
      for (const z of [-this.d / 2 + inset, this.d / 2 - inset]) {
        this.cylinder(finish, radius, radius * 0.7, height, x, height / 2, z)
      }
    }
  }

  component(name: string) {
    return this.item.components?.find(component => component.kind === name)
  }

  localX(name: string, fallback = 0) {
    const component = this.component(name)
    if (!component) return fallback
    const [x, y] = this.item.center
    const angle = this.item.facing * Math.PI / 180
    return Math.sin(angle) * ((component.x ?? x) - x) - Math.cos(angle) * ((component.y ?? y) - y)
  }

  finish() {
    return Array.from(this.parts, ([finish, parts]) => {
      const geometry = mergeGeometries(parts)
      parts.forEach(part => part.dispose())
      return { finish, geometry }
    })
  }
}

function bed(p: Piece) {
  const { w, d, h } = p
  const { width = w - 0.12, depth = d - 0.14 } = p.component('mattress') ?? {}
  p.legs('oak', 0.14, 0.13, 0.036)
  p.box('oak', w, 0.18, d, 0, 0.22, 0, 0.045)
  p.box('linen', w - 0.06, h - 0.20, 0.12, 0, (h + 0.20) / 2, -d / 2 + 0.06, 0.05)
  p.box('bedding', width, 0.22, depth, 0, 0.42, 0.05, 0.05)
  p.box('bedding', width + 0.03, 0.075, depth * 0.71, 0, 0.54, depth * 0.19, 0.035)
  p.box('linen', width + 0.045, 0.09, 0.48, 0, 0.57, d / 2 - 0.26, 0.038)
  for (const x of [-width * 0.24, width * 0.24]) {
    p.box('bedding', width * 0.43, 0.15, 0.43, x, 0.59, -d / 2 + 0.37, 0.065, 0.18)
  }
}

function cabinet(p: Piece, columns: number, rows: number, bottom: number, top = p.h, x = 0, width = p.w) {
  const { d } = p
  const height = top - bottom
  p.box('oak', width, height, d - 0.045, x, bottom + height / 2, -0.0225)
  for (let col = 0; col < columns; col++) {
    const cx = x + width * ((col + 0.5) / columns - 0.5)
    for (let row = 0; row < rows; row++) {
      const cy = bottom + height * (row + 0.5) / rows
      p.box('oak', width / columns - 0.006, height / rows - 0.006, 0.025, cx, cy, d / 2 - 0.032, 0.003)
      const tall = height / rows > 0.85
      p.box('metal', tall ? 0.012 : 0.105, tall ? 0.18 : 0.012, 0.02,
        tall ? cx + width / columns * 0.32 : cx, tall ? Math.min(cy, 1.11) : cy + height / rows * 0.27, d / 2 - 0.011)
    }
  }
}

function shelving(p: Piece, bays: number) {
  const { w, d, h } = p
  const post = 0.034
  for (let i = 0; i <= bays; i++) {
    p.box('oak', post, h, d, (w - post) * (i / bays - 0.5), h / 2, 0, 0.004)
  }
  for (let i = 0; i < 6; i++) {
    const y = 0.13 + i * (h - 0.15) / 5
    p.box('oak', w, 0.03, d, 0, y, 0, 0.004)
    if (i < 5) {
      const x = (w - post) * ((i % bays + 0.5) / bays - 0.5)
      for (let book = 0; book < 3; book++) {
        const height = 0.17 + 0.025 * book
        p.box(book === 1 ? 'fabric' : 'linen', 0.032, height, 0.13, x + book * 0.037, y + 0.015 + height / 2, 0)
      }
    }
  }
}

function table(p: Piece, finish: Finish = 'oak', slatted = false) {
  const { w, d, h } = p
  p.legs(finish, h - 0.04, Math.min(w, d) * 0.13, h > 0.6 ? 0.03 : 0.021)
  const slats = slatted ? 7 : 1
  for (let i = 0; i < slats; i++) {
    p.box(finish, w, 0.045, d / slats - (slatted ? 0.005 : 0), 0, h - 0.0225, d * ((i + 0.5) / slats - 0.5), 0.015)
  }
  if (p.item.kind === 'entryConsole') p.box('oak', w - 0.08, 0.025, d - 0.04, 0, 0.18, 0)
}

function chair(p: Piece, outdoor = false) {
  const { w, d, h } = p
  const wood = outdoor ? 'teak' : 'oak'
  p.legs(wood, 0.43, 0.063, 0.021)
  p.box(wood, w - 0.045, 0.035, d - 0.065, 0, 0.43, 0.019, 0.014)
  p.box(outdoor ? 'linen' : 'charcoal', w - 0.055, 0.055, d - 0.10, 0, 0.47, 0.03, 0.025)
  for (const x of [-w / 2 + 0.063, w / 2 - 0.063]) {
    p.box(wood, 0.034, h - 0.40, 0.036, x, (h + 0.40) / 2 - 0.012, -d / 2 + 0.055, 0.01, -0.10)
  }
  p.box(wood, w - 0.035, 0.135, 0.045, 0, h - 0.078, -d / 2 + 0.043, 0.018, -0.10)
}

function sofa(p: Piece, seats: number, outdoor = false) {
  const { w, d, h } = p
  const frame = outdoor ? 'teak' : 'fabric'
  const cushion = outdoor ? 'bedding' : 'linen'
  const arm = outdoor ? 0.07 : 0.145
  p.legs(outdoor ? 'teak' : 'oak', 0.13, 0.073, 0.027)
  p.box(frame, w, 0.16, d - 0.025, 0, 0.20, 0, 0.035)
  p.box(frame, w, h - 0.32, 0.11, 0, (h + 0.22) / 2, -d / 2 + 0.068, 0.04)
  for (const x of [-(w - arm) / 2, (w - arm) / 2]) {
    p.box(frame, arm, outdoor ? 0.055 : 0.36, d - 0.05, x, outdoor ? 0.56 : 0.385, 0, 0.028)
    if (outdoor) p.box(frame, arm * 0.75, 0.35, 0.06, x, 0.39, d / 2 - 0.07, 0.012)
  }
  const bay = (w - 2 * arm) / seats
  for (let i = 0; i < seats; i++) {
    const x = bay * (i + 0.5 - seats / 2)
    p.box(cushion, bay - 0.016, 0.15, d - 0.21, x, 0.355, 0.066, 0.05)
    p.box(cushion, bay - 0.016, h - 0.39, 0.15, x, (h + 0.37) / 2, -d / 2 + 0.172, 0.06, -0.15)
  }
}

function faucet(p: Piece, x: number, top: number, z: number, height: number) {
  p.cylinder('steel', 0.026, 0.026, 0.014, x, top + 0.007, z)
  p.cylinder('steel', 0.013, 0.016, height, x, top + height / 2, z)
  p.cylinder('steel', 0.011, 0.011, 0.13, x, top + height - 0.01, z + 0.055, Math.PI / 2)
  p.cylinder('steel', 0.011, 0.011, 0.024, x, top + height - 0.02, z + 0.117)
}

// Four stone borders leave a real opening into the undermount bowl.
function insetSink(p: Piece, x: number, width: number, depth: number, finish: Finish, tall = false) {
  const { w, d, h } = p
  const slab = 0.04
  const side = (d - depth) / 2
  const left = w / 2 + x - width / 2
  const right = w / 2 - x - width / 2
  for (const z of [-(d + depth) / 4, (d + depth) / 4]) p.box('quartz', w, slab, side, 0, h - slab / 2, z)
  p.box('quartz', left, slab, depth, -w / 2 + left / 2, h - slab / 2, 0)
  p.box('quartz', right, slab, depth, w / 2 - right / 2, h - slab / 2, 0)
  p.box(finish, width + 0.026, 0.021, depth + 0.026, x, h - 0.135, 0, 0.009)
  for (const z of [-depth / 2, depth / 2]) p.box(finish, width + 0.02, 0.11, 0.019, x, h - 0.08, z)
  for (const edge of [-width / 2, width / 2]) p.box(finish, 0.019, 0.11, depth, x + edge, h - 0.08, 0)
  p.cylinder('steel', 0.027, 0.027, 0.006, x, h - 0.121, 0)
  p.box('oak', w, 0.10, 0.025, 0, h - 0.09, d / 2 - 0.036)
  faucet(p, x, h, -depth / 2 - side / 2, tall ? 0.29 : 0.16)
}

function cooktop(p: Piece, name: string, width = 0.35, depth = 0.46) {
  const x = p.localX(name)
  const w = p.component(name)?.width ?? width
  const d = p.component(name)?.depth ?? depth
  p.box('screen', w, 0.014, d, x, p.h + 0.005, 0, 0.007)
  const radius = Math.min(w / 5, d / 5)
  for (const side of [-w / 4, w / 4]) {
    for (const z of [-d / 4, d / 4]) {
      p.lathe('charcoal', [[radius - 0.003, 0], [radius, 0], [radius, -0.002]], x + side, p.h + 0.013, z)
    }
  }
}

function grill(p: Piece) {
  const x = p.localX('gasGrill')
  const w = p.component('gasGrill')?.width ?? 0.75
  p.box('steel', w, 0.11, 0.50, x, p.h + 0.035, 0, 0.015)
  p.box('steel', w - 0.035, 0.24, 0.45, x, p.h + 0.18, -0.015, 0.105)
  p.box('metal', w - 0.05, 0.024, 0.02, x, p.h + 0.09, 0.228)
  for (const dx of [-w * 0.28, w * 0.28]) p.box('steel', 0.023, 0.024, 0.065, x + dx, p.h + 0.19, 0.233)
  p.box('metal', w * 0.61, 0.026, 0.028, x, p.h + 0.19, 0.266, 0.011)
  for (const dx of [-0.20, 0, 0.20]) p.cylinder('metal', 0.024, 0.024, 0.023, x + dx, p.h + 0.018, 0.255, Math.PI / 2)
}

function arch(width: number, jamb: number, sill = 0) {
  const radius = width / 2
  const shape = new Shape()
  shape.moveTo(-radius, sill)
  shape.lineTo(radius, sill)
  shape.absarc(0, jamb + sill, radius, 0, Math.PI, false)
  shape.closePath()
  return shape
}

function pizzaOven(p: Piece) {
  const base = p.component('base')?.height ?? 0.90
  const radius = (p.component('ovenDome')?.width ?? 0.80) / 2
  const crown = 0.57
  p.box('linen', p.w, base - 0.055, p.d, 0, (base - 0.055) / 2, 0, 0.018)
  p.box('quartz', p.w, 0.065, p.d, 0, base - 0.0325, 0, 0.014)
  const profile: [number, number][] = [[radius, 0]]
  for (let i = 0; i <= 8; i++) {
    const angle = i * Math.PI / 16
    profile.push([radius * Math.cos(angle), 0.12 + (crown - 0.12) * Math.sin(angle)])
  }
  p.lathe('quartz', profile, 0, base, -0.005)
  // Form the tunnel surround from an arch with a recessed dark firebox.
  const surround = arch(0.46, 0.12)
  const opening = arch(0.36, 0.11, 0.012)
  surround.holes.push(opening)
  p.add('teak', new ExtrudeGeometry(surround, { depth: 0.085, bevelEnabled: false, curveSegments: 10 }), 0, base, 0.306)
  p.add('charcoal', new ExtrudeGeometry(arch(0.362, 0.11), { depth: 0.01, bevelEnabled: false, curveSegments: 10 }), 0, base + 0.012, 0.367)
  p.cylinder('metal', 0.052, 0.063, p.h - base - crown + 0.055, 0, (p.h + base + crown - 0.055) / 2, -0.09)
  p.cylinder('steel', 0.074, 0.074, 0.025, 0, p.h - 0.013, -0.09)
}

function pendant(p: Piece, linear = false) {
  const { w, d, h } = p
  if (linear) {
    p.box('metal', w, h, d, 0, h / 2, 0, 0.021)
    p.box('bulb', w - 0.07, 0.007, d - 0.035, 0, -0.001, 0, 0.003)
  } else {
    p.lathe('metal', [[w / 2 - 0.005, 0], [w / 2, 0], [w / 2, 0.018], [w * 0.38, h * 0.69], [0.024, h], [0, h]], 0, 0, 0)
    p.cylinder('bulb', 0.047, 0.047, 0.012, 0, 0.013, 0)
  }
  const ceiling = 3 - (p.item.elevation ?? 0)
  for (const x of linear ? [-w * 0.34, w * 0.34] : [0]) {
    p.cylinder('metal', 0.004, 0.004, ceiling - h, x, (ceiling + h) / 2, 0)
    p.cylinder('metal', 0.04, 0.04, 0.018, x, ceiling - 0.009, 0)
  }
}

const builders: Record<ProceduralKind, (p: Piece) => void> = {
  bedQueen: bed,
  bedKing: bed,
  nightstand: p => { p.legs('oak', 0.115); cabinet(p, 1, 2, 0.11) },
  wardrobe: p => cabinet(p, Math.ceil(p.w / 0.60), 1, 0.06),
  desk: p => {
    table(p)
    p.box('oak', p.w - 0.13, 0.07, 0.06, 0, p.h - 0.077, -p.d / 2 + 0.055)
  },
  deskChair: p => chair(p),
  rug: p => p.box('wool', p.w, p.h, p.d, 0, p.h / 2, 0, 0.004),
  showerTray: p => {
    p.box('quartz', p.w, p.h, p.d, 0, p.h / 2, 0, 0.013)
    p.cylinder('steel', 0.035, 0.035, 0.003, p.w / 2 - 0.22, p.h + 0.001, 0)
  },
  showerGlass: p => {
    p.box('glass', p.w, p.h - 0.018, 0.009, 0, p.h / 2, 0)
    for (const x of [-p.w / 2 + 0.014, p.w / 2 - 0.014]) p.box('steel', 0.023, 0.038, p.d, x, 0.039, 0)
    p.box('steel', p.w, 0.012, 0.014, 0, p.h - 0.006, 0)
  },
  showerHead: p => {
    p.cylinder('steel', p.w / 2, p.w / 2, 0.019, 0, 0.012, p.d / 2 - p.w / 2)
    const mountDepth = p.item.room === 'bathroom' ? 0.06 : 0
    p.cylinder('steel', 0.012, 0.012, p.d - 0.08 + mountDepth, 0, 0.063, -0.04 - mountDepth / 2, Math.PI / 2)
    p.cylinder('steel', 0.012, 0.012, 0.057, 0, 0.044, p.d / 2 - p.w / 2)
  },
  showerMixer: p => {
    p.cylinder('steel', 0.054, 0.054, p.d - 0.015, 0, p.h / 2, -0.0075, Math.PI / 2)
    p.box('steel', 0.064, 0.013, 0.025, 0.039, p.h / 2, 0.023, 0.004)
  },
  vanity: p => { cabinet(p, 2, 2, 0.27, p.h - 0.14); insetSink(p, 0, 0.45, 0.27, 'quartz') },
  mirror: p => {
    p.box('metal', p.w, p.h, p.d * 0.7, 0, p.h / 2, -0.004, 0.01)
    p.box('mirror', p.w - 0.026, p.h - 0.026, 0.007, 0, p.h / 2, 0.01, 0.003)
  },
  bench: p => {
    p.legs('oak', p.h - 0.12)
    p.box('oak', p.w, 0.06, p.d, 0, p.h - 0.115, 0, 0.018)
    p.box('linen', p.w - 0.018, 0.115, p.d - 0.012, 0, p.h - 0.0575, 0, 0.05)
  },
  openShelving: p => shelving(p, 1),
  ottoman: p => {
    p.box('oak', p.w - 0.05, 0.06, p.d - 0.05, 0, 0.03, 0, 0.023)
    p.box('fabric', p.w, p.h - 0.055, p.d, 0, (p.h + 0.055) / 2, 0, 0.085)
  },
  sofa: p => sofa(p, 3),
  coffeeTable: p => table(p, p.item.room === 'veranda' ? 'teak' : 'oak'),
  mediaConsole: p => { p.legs('oak', 0.16); cabinet(p, 3, 1, 0.15) },
  tv: p => {
    p.box('metal', p.w, p.h, p.d - 0.008, 0, p.h / 2, -0.004, 0.011)
    p.box('screen', p.w - 0.024, p.h - 0.03, 0.009, 0, p.h / 2 + 0.003, p.d / 2 - 0.006, 0.004)
    p.box('indicator', 0.009, 0.004, 0.004, p.w * 0.42, 0.012, p.d / 2 - 0.002)
  },
  floorLamp: p => {
    p.cylinder('metal', 0.145, 0.15, 0.028, 0, 0.014, 0)
    p.cylinder('metal', 0.012, 0.012, p.h - 0.13, 0, (p.h - 0.09) / 2, 0)
    p.lathe('linen', [[0.163, 0], [0.175, 0], [0.103, 0.26], [0.091, 0.26]], 0, p.h - 0.26, 0)
  },
  entryConsole: p => table(p),
  roomDivider: p => shelving(p, 5),
  diningTable: p => table(p),
  diningChair: p => chair(p),
  sideboard: p => { p.legs('oak', 0.16); cabinet(p, 3, 1, 0.15) },
  linearPendant: p => pendant(p, true),
  kitchenBase: p => {
    const width = p.component('dishwasher')?.width ?? 0.60
    const x = p.localX('dishwasher')
    const left = p.w / 2 + x - width / 2
    const right = p.w / 2 - x - width / 2
    cabinet(p, 2, 1, 0.10, p.h - 0.13, (left - p.w) / 2, left)
    cabinet(p, 1, 2, 0.10, p.h - 0.13, (p.w - right) / 2, right)
    cabinet(p, 1, 1, 0.10, p.h - 0.13, x, width)
    p.box('oak', p.w - 0.035, 0.10, p.d - 0.12, 0, 0.05, -0.022)
    insetSink(p, p.localX('sink'), 0.45, 0.35, 'steel', true)
  },
  ovenColumn: p => {
    const oven = p.component('oven')
    const bottom = oven?.elevation ?? 0.85
    const height = oven?.height ?? 0.60
    const microwaveBottom = p.component('combiMicrowave')?.elevation ?? bottom + height
    cabinet(p, 1, 2, 0.065, bottom)
    cabinet(p, 1, 1, microwaveBottom + 0.41, p.h)
    for (const [y, h] of [[bottom, height], [microwaveBottom, 0.41]]) {
      p.box('metal', p.w, h - 0.007, p.d, 0, y + h / 2, 0, 0.009)
      p.box('screen', p.w - 0.045, h - 0.12, 0.011, 0, y + (h - 0.07) / 2, p.d / 2, 0.013)
      p.box('steel', p.w - 0.09, 0.021, 0.032, 0, y + h - 0.11, p.d / 2 + 0.014, 0.007)
      for (const x of [-0.20, 0.20]) p.cylinder('steel', 0.018, 0.018, 0.014, x, y + h - 0.044, p.d / 2, Math.PI / 2)
      for (const x of [-0.019, -0.006, 0.006, 0.019]) p.box('indicator', 0.008, 0.014, 0.004, x, y + h - 0.044, p.d / 2)
    }
  },
  island: p => {
    cabinet(p, 4, 2, 0.08, p.h - 0.045)
    p.box('oak', p.w - 0.04, 0.08, p.d - 0.13, 0, 0.04, -0.025)
    p.box('quartz', p.w, 0.047, p.d, 0, p.h - 0.0235, 0, 0.011)
    cooktop(p, 'inductionCooktop')
  },
  breakfastBar: p => {
    p.box('oak', p.w, 0.065, p.d, 0, p.h - 0.0325, 0, 0.012)
    for (const x of [-p.w * 0.43, p.w * 0.43]) p.box('oak', 0.06, p.h - 0.06, 0.10, x, (p.h - 0.06) / 2, p.d * 0.30, 0.008)
  },
  barStool: p => {
    p.legs('oak', p.h - 0.065, 0.056)
    p.box('charcoal', p.w - 0.015, 0.075, p.d - 0.025, 0, p.h - 0.0375, 0, 0.035)
    for (const x of [-0.154, 0.154]) p.box('metal', 0.022, 0.025, 0.31, x, 0.26, 0)
    p.box('metal', 0.31, 0.028, 0.028, 0, 0.26, 0.151)
  },
  hood: p => {
    p.box('steel', p.w, p.h, p.d, 0, p.h / 2, 0, 0.021)
    p.box('charcoal', p.w * 0.72, 0.008, p.d * 0.63, 0, 0.001, 0, 0.004)
    const duct = p.component('duct')
    const height = duct?.height ?? 0.68
    p.box('steel', 0.28, height, 0.22, 0, (duct?.elevation ?? 2.32) - (p.item.elevation ?? 2.20) + height / 2, 0, 0.008)
  },
  pendant: p => pendant(p),
  laundryCabinet: p => cabinet(p, 2, 1, 0.07),
  laundryTank: p => { cabinet(p, 1, 1, 0.10, p.h - 0.14); insetSink(p, 0, 0.48, 0.41, 'quartz') },
  basin: p => {
    p.add('quartz', new LatheGeometry([[0.02, 0], [0.09, 0], [0.155, 0.032], [0.19, 0.09], [0.19, 0.13],
      [0.177, 0.13], [0.173, 0.092], [0.135, 0.044], [0.05, 0.02], [0, 0.02]].map(([r, y]) => new Vector2(r, y)), 24),
    0, p.h - 0.13, 0.008)
    p.box('quartz', 0.12, 0.055, 0.09, 0, p.h - 0.093, -0.151, 0.012)
    faucet(p, 0, p.h - 0.066, -0.16, 0.18)
  },
  roundMirror: p => {
    p.cylinder('metal', p.w / 2, p.w / 2, 0.018, 0, p.h / 2, -0.004, Math.PI / 2)
    p.add('mirror', new CylinderGeometry(p.w / 2 - 0.009, p.w / 2 - 0.009, 0.006, 32), 0, p.h / 2, 0.007, Math.PI / 2)
  },
  gourmetCounter: p => {
    cabinet(p, 4, 1, 0.09, p.h - 0.14)
    p.box('oak', p.w - 0.035, 0.09, p.d - 0.12, 0, 0.045, -0.022)
    insetSink(p, p.localX('sink'), 0.46, 0.37, 'steel')
    cooktop(p, 'cooktop', 0.32)
    grill(p)
  },
  pizzaOven,
  outdoorTable: p => table(p, 'teak', true),
  outdoorChair: p => chair(p, true),
  outdoorSofa: p => sofa(p, 3, true),
  outdoorArmchair: p => sofa(p, 1, true),
  sunLounger: p => {
    p.legs('teak', 0.255, 0.105)
    p.box('teak', p.w, 0.067, p.d, 0, 0.28, 0, 0.019)
    p.box('bedding', p.w - 0.045, 0.095, p.d - 0.80, 0, p.h - 0.0475, 0.37, 0.038)
    const length = 0.83
    const tilt = Math.asin(((p.component('backrest')?.height ?? 0.85) - p.h) / length)
    p.box('teak', p.w, 0.05, length, 0, 0.53, -0.55, 0.018, tilt)
    p.box('bedding', p.w - 0.045, 0.088, length - 0.025, 0, 0.59, -0.51, 0.038, tilt)
  },
}

export function buildFurnitureGeometry(item: ProceduralItem) {
  const piece = new Piece(item)
  builders[item.kind](piece)
  return piece.finish()
}

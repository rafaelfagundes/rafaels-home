import { contains, floorElevation, polygonArea, rectangle, type Floor, type Footprint, type Point } from './geometry'
import type { Zone } from './house'

type Rect = readonly [number, number, number, number]
const footprint = (rect: Rect) => ({ polygon: rectangle(rect) })
const centered = ([x, y]: Point, width: number, depth: number) =>
  footprint([x - width / 2, y - depth / 2, x + width / 2, y + depth / 2])

function outdoorZone(key: string, namePt: string, label: Point, floor: number, shape: Footprint): Zone {
  return { ...shape, id: key, key, namePt, label, floor, areaComputed: polygonArea(shape), indoor: false }
}

export function createOutdoorFeatures(yard: number, pool: Zone) {
  const deckHeight = yard + 0.02
  const lounge = outdoorZone('fire_lounge', 'Lounge com Lareira Externa', [22.75, 8.99], deckHeight - 0.45,
    footprint([21.4, 6.9, 25.6, 9.7]))
  const woodDeck = outdoorZone('wood_deck', 'Deck de Madeira', [16.8, 13.4], yard + 0.03,
    footprint([15.66, 12.8, 18, 14]))
  const xs = pool.polygon.map(([x]) => x)
  const ys = pool.polygon.map(([, y]) => y)
  const [west, north, east, south] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  const deck = outdoorZone('pool_deck', 'Deck da Piscina', [25.65, 12.4], deckHeight, {
    polygon: [
      [16.46, 9.74], [26.4, 9.74], [26.4, 16.6], [east + 1.2, 16.6],
      [east + 1.2, south + 1.2], [west - 1.2, south + 1.2], [west - 1.2, 16.6],
      [16.46, 16.6], [16.46, 14], [18, 14], [18, 12.8], [16.46, 12.8],
    ],
    holes: [pool.polygon],
  })
  const poolInterior = footprint([west + 0.3, north + 0.3, east - 0.3, south - 0.3])
  // The first tread starts below the paving. Existing camera damping smooths each riser.
  const steps = [0, 1, 2].map(index => ({
    ...footprint([21.4 + index * 0.3, 6.9, 21.7 + index * 0.3, 9.7]),
    floor: deckHeight - (index + 1) * 0.15,
    light: [21.412 + index * 0.3, deckHeight - index * 0.15 - 0.075, 8.3] as const,
  }))
  const apronNotch = [[20.5, 6.5], [26, 6.5], [26, 9.74]] as const
  const loungeApron = [
    footprint([20.5, 6.5, 21.4, 9.74]),
    footprint([21.4, 6.5, 26, 6.9]),
    footprint([25.6, 6.9, 26, 9.74]),
    footprint([21.4, 9.7, 25.6, 9.74]),
  ].map(shape => ({ ...shape, floor: deckHeight }))
  const bench = [
    footprint([21.4, 6.9, 25.15, 7.35]),
    footprint([25.15, 6.9, 25.6, 9.7]),
    footprint([21.4, 9.25, 25.15, 9.7]),
  ]
  const fireCenter: Point = [23.5, 8.3]
  const firePit = centered(fireCenter, 2.2, 0.45)
  const fireBasin = centered(fireCenter, 2.08, 0.33)
  const poolLights = [0.2, 0.5, 0.8, 0.35, 0.65].map((fraction, index) => ({
    point: [west + 0.3 + (east - west - 0.6) * fraction, index < 3 ? north + 0.305 : south - 0.305] as Point,
    heading: index < 3 ? 0 : Math.PI,
  }))
  return { deck, lounge, woodDeck, loungeApron, apronNotch, poolInterior, poolLights, steps, bench, firePit, fireBasin, fireCenter }
}

export const planters = ([
  [17, 10.3], [17, 12], [22, 6.62], [22, 10], [1.24, 10.48], [1.24, 11.28],
] as const).map(point => ({ point, ...centered(point, 1.2, 0.4), height: 0.5 }))

export const trees = ([
  ['juniper', 1.2, 3, 4.1], ['juniper', 1.2, 9, 3.8], ['juniper', 26.9, 9.4, 4.4],
  ['olive', 28.6, 4.2, 4], ['olive', 28.4, 15.4, 4],
] as const).map(([kind, x, y, height]) => {
  const point: Point = [x, y]
  return { kind, point, height, ...centered(point, kind === 'olive' ? 0.4 : 0.24, kind === 'olive' ? 0.4 : 0.24) }
})

export type PlantKind = 'bamboo' | 'horsetail' | 'fescue' | 'feather'
export interface Plant { kind: PlantKind; point: Point; height: number; heading: number; elevation: number }
const beds: readonly [PlantKind, Rect, number][] = [
  ['bamboo', [1.94, 0.27, 30.39, 0.64], 210],
  ['bamboo', [30.45, 0.27, 31.22, 18.68], 200],
  ['bamboo', [16.55, 18.2, 30.44, 18.73], 110],
  ['horsetail', [2, 0.59, 20.4, 0.73], 125],
  ['horsetail', [2, 2.03, 19.42, 2.26], 140],
  ['horsetail', [1.55, 0.86, 1.84, 11.57], 110],
  ['horsetail', [20.52, 1.9, 20.75, 6.69], 45],
  ['horsetail', [19.28, 2.04, 19.48, 6.69], 45],
  ['fescue', [0.79, 0.9, 1.65, 11.5], 28],
  ['feather', [0.82, 0.9, 1.6, 11.5], 33],
  ['feather', [26.58, 9.78, 27.19, 16.8], 35],
  ['fescue', [17.05, 16.98, 26.6, 17.53], 55],
  ['feather', [12.26, 18.22, 16.37, 18.7], 25],
  ['fescue', [21.46, 6.27, 25.65, 6.76], 20],
  ['feather', [25.78, 6.95, 26.22, 9.59], 20],
]
const heights: Record<PlantKind, readonly [number, number]> = {
  bamboo: [3, 4.2], horsetail: [0.5, 0.9], fescue: [0.2, 0.28], feather: [0.6, 0.8],
}

export function generatePlants(zones: readonly Floor[], exclusions: readonly Footprint[], seed = 84217): Plant[] {
  const plants: Plant[] = []
  function random() {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0
    return seed / 4294967296
  }
  function plant(kind: PlantKind, point: Point, elevation: number): Plant {
    const [min, max] = heights[kind]
    return { kind, point, elevation, height: min + (max - min) * random(), heading: random() * Math.PI * 2 }
  }
  for (const [kind, [x0, y0, x1, y1], count] of beds) {
    for (let i = 0; i < count; i++) {
      const point: Point = [x0 + (x1 - x0) * random(), y0 + (y1 - y0) * random()]
      if (!exclusions.some(shape => contains(shape, point))) plants.push(plant(kind, point, floorElevation(point, zones)))
    }
  }
  return plants
}

export function generatePlanterPlants(zones: readonly Floor[]): Plant[] {
  return planters.flatMap(({ point: [x, y], height }) => {
    const elevation = floorElevation([x, y], zones) + height - 0.04
    return Array.from({ length: 7 }, (_, index) =>
      ({ kind: index % 2 ? 'feather' : 'fescue', point: [x - 0.46 + index * 0.15, y + Math.sin(index * 2) * 0.08],
        height: 0.32 + (index % 3) * 0.09, heading: index * 2, elevation }))
  })
}

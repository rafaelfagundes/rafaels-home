import { rectangle, type Footprint, type Ring } from './geometry'

export type Kind =
  | 'bedQueen' | 'bedKing' | 'nightstand' | 'wardrobe' | 'desk' | 'deskChair' | 'rug'
  | 'toilet' | 'showerTray' | 'showerGlass' | 'showerHead' | 'showerMixer' | 'vanity' | 'mirror'
  | 'bench' | 'plant' | 'openShelving' | 'ottoman' | 'sofa' | 'coffeeTable' | 'mediaConsole' | 'tv'
  | 'armchair' | 'loungechair' | 'floorLamp' | 'entryConsole' | 'roomDivider'
  | 'diningTable' | 'diningChair' | 'sideboard' | 'linearPendant' | 'kitchenBase' | 'ovenColumn'
  | 'fridge' | 'island' | 'breakfastBar' | 'barStool' | 'hood' | 'pendant'
  | 'laundryCabinet' | 'laundryTank' | 'washer' | 'dryer' | 'basin' | 'roundMirror'
  | 'gourmetCounter' | 'pizzaOven' | 'outdoorTable' | 'outdoorChair'
  | 'outdoorSofa' | 'outdoorArmchair' | 'sunLounger'
  | 'bmw_x5' | 'golf_r' | 'hayabusa'

export interface FurnitureItem {
  id: string
  kind: Kind
  room: string
  center: [number, number]
  size: [number, number, number] // Width, depth, height.
  facing: number // Plan degrees toward the front.
  collider?: boolean
  elevation?: number
  components?: readonly FurnitureComponent[]
}

interface FurnitureComponent {
  kind: string
  // Plan coordinates and heights above the item's floor.
  x?: number
  y?: number
  elevation?: number
  width?: number
  depth?: number
  height?: number
}

type Placement = [
  kind: Kind, center: FurnitureItem['center'], size: FurnitureItem['size'], facing: number,
  options?: Pick<FurnitureItem, 'collider' | 'elevation' | 'components'>,
]

function inRoom(room: string, placements: Placement[]): FurnitureItem[] {
  return placements.map(([kind, center, size, facing, options], index) =>
    ({ id: `${room}-${kind}-${index + 1}`, kind, room, center, size, facing, ...options }))
}

const queenMattress = { components: [{ kind: 'mattress', width: 1.58, depth: 1.98 }] }
const visual = { collider: false } as const
const raised = (elevation: number) => ({ ...visual, elevation })

const loungerBackrest = { components: [{ kind: 'backrest', height: 0.85 }] }

function translatePlacements(placements: Placement[], dx: number): Placement[] {
  return placements.map(([kind, [x, y], size, facing, options]) => [
    kind, [x + dx, y], size, facing, options,
  ])
}

const semiSuite: Placement[] = [
  ['bedQueen', [5.531, 4.437], [1.70, 2.12, 1.05], 270, queenMattress],
  ['nightstand', [4.381, 5.307], [0.45, 0.38, 0.50], 270],
  ['nightstand', [6.681, 5.307], [0.45, 0.38, 0.50], 270],
  ['wardrobe', [7.578, 2.95], [1.60, 0.60, 2.40], 180],
  ['desk', [4.134, 2.65], [1.00, 0.50, 0.75], 0],
  ['deskChair', [4.62, 2.65], [0.46, 0.50, 0.82], 180],
  ['rug', [5.531, 3.96], [1.60, 2.40, 0.01], 0, visual],
]

export const furnitureItems: FurnitureItem[] = [
  ...inRoom('semi_suite_1', semiSuite),
  ...inRoom('semi_suite_2', translatePlacements(semiSuite, 6.24)),
  ...inRoom('bathroom', [
    ['toilet', [8.50, 2.47], [0.37, 0.68, 0.80], 90],
    ['showerTray', [9.524, 2.761], [1.28, 0.95, 0.05], 180, visual],
    ['showerGlass', [9.05, 2.76], [1.28, 0.04, 2.0], 0],
    ['showerGlass', [9.32, 3.40], [0.50, 0.04, 2.0], 270],
    ['showerHead', [9.797, 2.76], [0.24, 0.36, 0.08], 180, raised(2.1)],
    ['showerMixer', [9.962, 2.76], [0.16, 0.07, 0.12], 180, raised(1.05)],
    ['vanity', [8.95, 5.257], [1.00, 0.48, 0.85], 270],
    ['mirror', [8.95, 5.48], [0.90, 0.03, 0.80], 270, raised(1.05)],
  ]),
  ...inRoom('master_suite', [
    ['bedKing', [15.328, 3.95], [2.05, 2.17, 1.10], 0, {
      components: [{ kind: 'mattress', width: 1.93, depth: 2.03 }],
    }],
    ['nightstand', [14.443, 2.60], [0.50, 0.40, 0.50], 0],
    ['nightstand', [14.443, 5.30], [0.50, 0.40, 0.50], 0],
    ['bench', [16.65, 3.95], [1.40, 0.42, 0.45], 0],
    ['rug', [15.70, 3.95], [2.60, 1.90, 0.01], 0, visual],
    ['plant', [15.43, 6.317], [0.60, 0.60, 1.34], 270],
  ]),
  ...inRoom('closet', [
    ['wardrobe', [18.458, 2.421], [1.84, 0.60, 2.40], 90],
    ['wardrobe', [17.84, 3.141], [0.83, 0.60, 2.40], 0],
    ['openShelving', [19.201, 3.011], [0.58, 0.35, 2.40], 180],
  ]),
  ...inRoom('master_bath', [
    ['vanity', [17.913, 4.90], [1.20, 0.50, 0.85], 0],
    ['mirror', [17.68, 4.90], [0.90, 0.03, 0.80], 0, raised(1.05)],
    ['toilet', [19.038, 5.12], [0.37, 0.68, 0.80], 180],
    ['showerTray', [18.523, 6.182], [1.72, 0.87, 0.05], 270, visual],
    ['showerGlass', [18.183, 5.75], [1.04, 0.05, 2.0], 270],
    ['showerHead', [17.85, 6.185], [0.24, 0.36, 0.08], 0, raised(2.1)],
  ]),
  ...inRoom('living', [
    ['sofa', [6.55, 8.625], [2.40, 0.95, 0.80], 270],
    ['coffeeTable', [7.05, 7.40], [1.10, 0.60, 0.38], 270],
    ['mediaConsole', [5.975, 5.85], [2.00, 0.45, 0.50], 90],
    ['tv', [5.975, 5.655], [1.45, 0.05, 0.84], 90, raised(0.95)],
    ['loungechair', [5.40, 7.40], [1.01, 1.19, 1.17], 0],
    ['rug', [6.20, 7.50], [2.80, 2.00, 0.01], 270, visual],
    ['floorLamp', [4.35, 9.30], [0.35, 0.35, 1.60], 0],
    ['plant', [4.40, 8.55], [0.60, 0.60, 1.34], 0],
    ['entryConsole', [4.185, 10.80], [1.20, 0.35, 0.80], 0],
    ['roomDivider', [6.20, 11.285], [3.17, 0.30, 2.40], 180],
  ]),
  ...inRoom('dining', [
    ['diningTable', [10.05, 7.60], [2.20, 1.00, 0.75], 90],
    ...[9.30, 10.05, 10.80].flatMap((x): Placement[] => [
      ['diningChair', [x, 6.80], [0.48, 0.52, 0.80], 90, visual],
      ['diningChair', [x, 8.40], [0.48, 0.52, 0.80], 270, visual],
    ]),
    ['diningChair', [8.63, 7.60], [0.48, 0.52, 0.80], 0, visual],
    ['diningChair', [11.47, 7.60], [0.48, 0.52, 0.80], 180, visual],
    ['sideboard', [10.00, 5.85], [2.60, 0.45, 0.75], 90],
    ['linearPendant', [10.05, 7.60], [1.35, 0.10, 0.12], 90, raised(2.10)],
    // The kitchen stools sit on the dining side of the room boundary.
    ...[8.60, 9.25, 9.90].map((x): Placement =>
      ['barStool', [x, 9.55], [0.42, 0.42, 0.65], 90, visual]),
  ]),
  ...inRoom('kitchen', [
    ['kitchenBase', [7.40, 12.57], [2.00, 0.60, 0.90], 270, {
      components: [
        { kind: 'sink', x: 7.73 },
        { kind: 'dishwasher', x: 7.15, width: 0.60 },
      ],
    }],
    ['ovenColumn', [8.70, 12.57], [0.60, 0.60, 2.30], 270, {
      components: [
        { kind: 'oven', elevation: 0.85, height: 0.60 },
        { kind: 'combiMicrowave', elevation: 1.45 },
      ],
    }],
    ['fridge', [10.805, 12.495], [0.91, 0.75, 1.85], 270],
    ['island', [9.11, 10.668], [2.50, 0.90, 0.90], 90, {
      components: [{ kind: 'inductionCooktop', x: 8.27, width: 0.60, depth: 0.52 }],
    }],
    ['breakfastBar', [9.11, 10.043], [2.71, 0.35, 0.90], 270],
    ['hood', [8.27, 10.668], [0.90, 0.50, 0.12], 90, {
      ...raised(2.20), components: [{ kind: 'duct', elevation: 2.32, height: 0.68 }],
    }],
    ...[9.3, 10.2].map((x): Placement => ['pendant', [x, 10.043], [0.16, 0.16, 0.20], 90, raised(2.10)]),
  ]),
  ...inRoom('service', [
    ['laundryCabinet', [10.65, 13.575], [0.95, 0.45, 2.20], 180],
    ['laundryTank', [9.305, 14.50], [0.65, 0.60, 0.90], 0],
    ['washer', [10.688, 14.885], [0.60, 0.62, 0.85], 180],
    ['dryer', [10.688, 14.885], [0.60, 0.62, 0.85], 180, raised(0.85)],
  ]),
  ...inRoom('powder_room', [
    ['basin', [12.322, 14.55], [0.45, 0.40, 0.85], 180],
    ['roundMirror', [12.50, 14.55], [0.45, 0.03, 0.45], 180, raised(1.05)],
    ['toilet', [12.182, 15.45], [0.37, 0.68, 0.80], 180],
  ]),
  ...inRoom('gourmet', [
    ['gourmetCounter', [12.989, 14.10], [2.30, 0.65, 0.92], 0, {
      components: [
        { kind: 'sink', y: 13.55 },
        { kind: 'cooktop', y: 14.25 },
        { kind: 'gasGrill', y: 14.75, width: 0.75 },
      ],
    }],
    ['pizzaOven', [13.064, 15.68], [0.86, 0.80, 1.75], 0, {
      components: [{ kind: 'base', height: 0.90 }, { kind: 'ovenDome', elevation: 0.90, width: 0.80, depth: 0.80 }],
    }],
    ['outdoorTable', [14.60, 13.95], [1.60, 0.90, 0.75], 0],
    ...[13.45, 14.45].flatMap((y): Placement[] => [
      ['outdoorChair', [14.0, y], [0.48, 0.52, 0.80], 0, visual],
      ['outdoorChair', [15.2, y], [0.48, 0.52, 0.80], 180, visual],
    ]),
    ['outdoorChair', [14.60, 13.13], [0.48, 0.52, 0.80], 90, visual],
    ['outdoorChair', [14.60, 15.00], [0.48, 0.52, 0.80], 270, visual],
  ]),
  ...inRoom('veranda', [
    ['outdoorSofa', [13.16, 9.50], [2.20, 0.90, 0.75], 0],
    ['coffeeTable', [14.15, 9.50], [1.00, 0.60, 0.38], 0],
    ['outdoorArmchair', [15.00, 9.05], [0.75, 0.80, 0.75], 180],
    ['outdoorArmchair', [15.00, 9.95], [0.75, 0.80, 0.75], 180],
  ]),
  ...inRoom('pool_deck', [
    ['sunLounger', [17.55, 14.55], [0.70, 1.95, 0.40], 0, loungerBackrest],
    ['sunLounger', [17.55, 15.55], [0.70, 1.95, 0.40], 0, loungerBackrest],
    ['sunLounger', [25.55, 13.40], [0.70, 1.95, 0.40], 90, loungerBackrest],
  ]),
]

export const vehicleItems = inRoom('garage', [
  ['bmw_x5', [5.79, 15.05], [2.10, 4.92, 1.75], 0],
  ['golf_r', [5.475, 17.56], [1.86, 4.29, 1.46], 0],
  ['hayabusa', [8.20, 17.40], [0.74, 2.18, 1.17], 270],
])

export function footprint({ center: [x, y], size: [width, depth], facing }: FurnitureItem): Ring {
  const angle = facing * Math.PI / 180
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  return rectangle([-width / 2, -depth / 2, width / 2, depth / 2]).map(([side, front]) =>
    [x + side * dy + front * dx, y - side * dx + front * dy])
}

export function colliders(items: FurnitureItem[]): Footprint[] {
  return items.filter(item => item.collider !== false).map(item => {
    const margin = item.kind === 'diningTable' ? 0.35 : item.kind === 'outdoorTable' ? 0.15 : 0
    const [width, depth, height] = item.size
    return { polygon: footprint({ ...item, size: [width + 2 * margin, depth + 2 * margin, height] }) }
  })
}

export const furnitureColliders = colliders(furnitureItems)
export const vehicleColliders = colliders(vehicleItems)

function bounds(item: FurnitureItem) {
  const corners = footprint(item)
  return {
    west: Math.min(...corners.map(([x]) => x)),
    east: Math.max(...corners.map(([x]) => x)),
    north: Math.min(...corners.map(([, y]) => y)),
    south: Math.max(...corners.map(([, y]) => y)),
  }
}

export function garageFit() {
  const [x5, golf, bike] = vehicleItems.map(bounds)
  // Use the specified parking envelope, including the shallower section of the south wall.
  const garage = { west: 3.08, north: 13, east: 8.88, south: 18.70, ceiling: 3.0 }
  return {
    walkwayWidth: x5.north - garage.north,
    x5GolfSideGap: golf.north - x5.south,
    golfSouthWall: garage.south - golf.south,
    x5FrontBackWall: garage.east - x5.east,
    golfFrontBike: bike.west - golf.east,
    bikeEastWall: garage.east - bike.east,
    rearBumpersOpening: Math.min(x5.west, golf.west) - garage.west,
    roofClearance: garage.ceiling - Math.max(...vehicleItems.map(item => item.size[2])),
  }
}

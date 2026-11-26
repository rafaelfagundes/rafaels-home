import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { floorElevation, planToWorld, segments, type Footprint, type WorldPoint } from '../model/geometry'
import { outdoorFeatures, plantExclusions, pool, walkingFloors } from '../model/house'
import { generatePlanterPlants, generatePlants, planters, trees, type PlantKind } from '../model/landscape'
import { prismGeometry } from './model'
import { getTexture, patterns, type PatternName } from './textures'

const { deck, lounge, woodDeck, loungeApron, poolInterior, steps, bench, firePit, fireBasin, fireCenter, poolLights } = outdoorFeatures
const box = new THREE.BoxGeometry()
const cylinder = new THREE.CylinderGeometry(0.42, 0.5, 1, 5, 1, true)
const cone = new THREE.ConeGeometry(0.5, 1, 6)
const pebble = new THREE.IcosahedronGeometry(0.5)
const worldFloor = (point: Parameters<typeof floorElevation>[0]) => floorElevation(point, walkingFloors)

function merge(pieces: THREE.BufferGeometry[]) {
  const geometry = mergeGeometries(pieces)
  pieces.forEach(piece => piece.dispose())
  return geometry
}

function slab(shape: Footprint, low: number, high: number, alongX = false) {
  const geometry = prismGeometry(shape, low, high)
  const position = geometry.getAttribute('position')
  const normals = geometry.getAttribute('normal')
  const uv = geometry.getAttribute('uv')
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index)
    const z = position.getZ(index)
    if (Math.abs(normals.getY(index)) < 0.5) {
      uv.setXY(index, Math.abs(normals.getX(index)) > 0.5 ? z : x, position.getY(index))
    } else {
      uv.setXY(index, alongX ? z : x, alongX ? x : z)
    }
  }
  return geometry
}

const pavingGeometry = merge([
  slab(deck, deck.floor - 0.04, deck.floor),
  ...loungeApron.map(shape => slab(shape, lounge.floor, shape.floor)),
])
const woodGeometry = slab(woodDeck, woodDeck.floor - 0.05, woodDeck.floor, true)
const loungeFloorGeometry = merge([
  slab(lounge, lounge.floor - 0.1, lounge.floor),
  ...steps.slice(0, -1).map(step => slab(step, lounge.floor, step.floor)),
])
const benchGeometry = merge(bench.map(shape => slab(shape, lounge.floor, deck.floor)))
const troughGeometry = merge([
  slab(firePit, lounge.floor, lounge.floor + 0.26),
  slab({ ...firePit, holes: [fireBasin.polygon] }, lounge.floor + 0.26, lounge.floor + 0.4),
])

const poolBottom = pool.floor - (pool.depth ?? 1.4)
const waterline = pool.floor - 0.15
const coping = { ...pool, holes: [poolInterior.polygon] }
const copingGeometry = slab(coping, deck.floor - 0.065, deck.floor + 0.015)
const basinGeometry = merge([
  slab(pool, poolBottom - 0.1, poolBottom),
  ...segments(pool.polygon).map(([a, b], i) => slab({
    polygon: [a, b, poolInterior.polygon[(i + 1) % poolInterior.polygon.length], poolInterior.polygon[i]],
  }, poolBottom, deck.floor - 0.065)),
])
const waterGeometry = slab(poolInterior, waterline - 0.008, waterline)

interface Instance {
  position: WorldPoint
  scale: WorldPoint
  heading?: number
  lean?: number
  tint?: number
}

function batch(geometry: THREE.BufferGeometry, instances: Instance[], color: string, white: string) {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.9 })
  const mesh = new THREE.InstancedMesh(geometry, material, instances.length)
  const transform = new THREE.Object3D()
  const shade = new THREE.Color()
  instances.forEach(({ position, scale, heading = 0, lean = 0, tint = 1 }, index) => {
    transform.position.set(...position)
    transform.scale.set(...scale)
    transform.rotation.set(0, heading, lean, 'YXZ')
    transform.updateMatrix()
    mesh.setMatrixAt(index, transform.matrix)
    mesh.setColorAt(index, shade.setScalar(tint))
  })
  mesh.receiveShadow = true
  return { mesh, color, white }
}

function blades(count: number, spread: number, bend: number) {
  const positions: number[] = []
  for (let index = 0; index < count; index++) {
    const angle = index * 2.4
    const dx = Math.cos(angle)
    const dz = Math.sin(angle)
    const radius = spread * (0.25 + (index % 4) * 0.2)
    const height = 1 - (index % 5) * 0.11
    const x = dx * radius
    const z = dz * radius
    const width = spread * 0.16
    const middleX = x + dx * bend * 0.35
    const middleZ = z + dz * bend * 0.35
    positions.push(
      x - dz * width, 0, z + dx * width,
      x + dz * width, 0, z - dx * width,
      middleX + dz * width / 2, height * 0.58, middleZ - dx * width / 2,
      x - dz * width, 0, z + dx * width,
      middleX + dz * width / 2, height * 0.58, middleZ - dx * width / 2,
      middleX - dz * width / 2, height * 0.58, middleZ + dx * width / 2,
      middleX - dz * width / 2, height * 0.58, middleZ + dx * width / 2,
      middleX + dz * width / 2, height * 0.58, middleZ - dx * width / 2,
      x + dx * bend, height, z + dz * bend,
    )
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

const bambooLeaves = merge(Array.from({ length: 4 }, (_, index) =>
  blades(5, 0.21, 0.21).scale(1, -0.14, 1).rotateY(index * 1.9)
    .translate(Math.cos(index * 1.9) * 0.21, 0.66 + index * 0.11, Math.sin(index * 1.9) * 0.21)))
const reeds = merge([
  cylinder.clone().scale(0.015, 1, 0.015).translate(0, 0.5, 0),
  ...[0.2, 0.39, 0.58, 0.77, 0.93].map(y => cylinder.clone().scale(0.025, 0.025, 0.025).translate(0, y, 0)),
])

const plantInstances: Record<PlantKind, Instance[]> = { bamboo: [], horsetail: [], fescue: [], feather: [] }
const bambooStems: Instance[] = []
for (const { kind, point, elevation, height, heading } of [
  ...generatePlants(walkingFloors, plantExclusions), ...generatePlanterPlants(walkingFloors),
]) {
  plantInstances[kind].push({ position: planToWorld(point, elevation), scale: [1, height, 1], heading,
    tint: 0.81 + heading / (2 * Math.PI) * 0.19 })
  if (kind === 'bamboo') bambooStems.push({
    position: planToWorld(point, elevation + height / 2), scale: [0.039, height, 0.039],
  })
}
const trunks: Instance[] = []
const junipers: Instance[] = []
const olives: Instance[] = []
for (const { kind, point, height } of trees) {
  const base = worldFloor(point)
  if (kind === 'juniper') {
    trunks.push({ position: planToWorld(point, base + height * 0.36), scale: [0.24, height * 0.72, 0.24] })
    junipers.push(
      { position: planToWorld(point, base + height * 0.53), scale: [0.86, height * 0.83, 0.86] },
      { position: planToWorld(point, base + height * 0.69), scale: [0.69, height * 0.62, 0.69], heading: 0.5, tint: 0.88 },
    )
    continue
  }
  const [x, y] = point
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2 + 0.45
    const dx = Math.cos(angle)
    const dz = -Math.sin(angle)
    trunks.push({ position: [x + dx * 0.28, base + 1.15, y + dz * 0.28],
      scale: [0.15, 2.4, 0.15], heading: angle, lean: -0.245 })
    olives.push({ position: [x + dx * 0.54, base + 2.85 + (i % 2) * 0.26, y + dz * 0.54],
      scale: [1.65, 1.56, 1.55], heading: angle, tint: 0.82 + i * 0.06 })
  }
  olives.push({ position: planToWorld(point, base + 3.28), scale: [1.85, 1.44, 1.85] })
}

const planterGeometry = merge([
  box.clone().scale(1.2, 0.42, 0.4).translate(0, 0.21, 0),
  ...[-1, 1].flatMap(side => [
    box.clone().scale(1.2, 0.08, 0.045).translate(0, 0.46, side * 0.1775),
    box.clone().scale(0.045, 0.08, 0.31).translate(side * 0.5775, 0.46, 0),
  ]),
])
const plantBatches = [
  batch(cylinder, bambooStems, '#6f7747', '#cbccc7'),
  batch(bambooLeaves, plantInstances.bamboo, '#5d7a3a', '#eaebe5'),
  batch(reeds, plantInstances.horsetail, '#415838', '#d8dad4'),
  batch(blades(12, 0.12, 0.13), plantInstances.fescue, '#7a9091', '#dee1de'),
  batch(blades(9, 0.055, 0.21), plantInstances.feather, '#a79b71', '#f0eee5'),
  batch(cylinder, trunks, '#72614b', '#cdcdc8'),
  batch(cone, junipers, '#3d5745', '#e3e5df'),
  batch(pebble, olives, '#7c8874', '#e9eae4'),
  batch(planterGeometry, planters.map(({ point }) => ({
    position: planToWorld(point, worldFloor(point)), scale: [1, 1, 1],
  })), '#1c1d1c', '#dbdcd8'),
]
for (const { mesh } of plantBatches.slice(1, 5)) mesh.material.side = THREE.DoubleSide
for (const { mesh } of plantBatches.slice(5)) mesh.castShadow = true

const underwater = batch(new THREE.CircleGeometry(0.088, 12), poolLights.map(({ point, heading }) => ({
  position: planToWorld(point, waterline - 0.4), heading, scale: [1, 1, 1],
})), '#e1f6ec', '#dddeda')
const stairLights = batch(box, steps.map(({ light }) => ({
  position: [...light], scale: [0.033, 0.044, 0.18],
})), '#ffe3b4', '#dadbd8')

const flames = batch(cone, Array.from({ length: 11 }, (_, index) => ({
  position: [-0.87 + index * 0.174, 0.09, Math.sin(index * 2.2) * 0.075],
  scale: [0.19, 0.2 + (index % 4) * 0.075, 0.145], lean: Math.sin(index * 2) * 0.18,
  tint: 0.55 + (index % 4) * 0.14,
})), '#ff7d29', '#fff')
const flameMaterial = new THREE.MeshBasicMaterial({
  color: flames.color, transparent: true, opacity: 0.76, blending: THREE.AdditiveBlending, depthWrite: false,
})
const flameMesh = new THREE.InstancedMesh(cone, flameMaterial, flames.mesh.count)
flameMesh.instanceMatrix = flames.mesh.instanceMatrix
flameMesh.instanceColor = flames.mesh.instanceColor
const whiteEdges = [pavingGeometry, woodGeometry, loungeFloorGeometry, benchGeometry, troughGeometry]
  .map(geometry => new THREE.EdgesGeometry(geometry, 24))

function Surface({ geometry, white, pattern, color, floor = false }: {
  geometry: THREE.BufferGeometry; white: boolean; pattern?: PatternName; color: string; floor?: boolean
}) {
  const map = !white && pattern ? getTexture(pattern) : null
  return <mesh geometry={geometry} userData={{ pick: true, floor }} receiveShadow>
    <meshStandardMaterial map={map} color={white ? '#e1e2dd' : map ? '#fff' : pattern ? patterns[pattern].color : color}
      roughness={0.86} />
  </mesh>
}

function OutdoorEffects({ white, night }: { white: boolean; night: boolean }) {
  const water = getTexture('waterRipple')
  const flameGroup = useRef<THREE.Group>(null)
  const fireLight = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    if (white) return
    const time = clock.elapsedTime
    water?.offset.set(time * 0.053, Math.sin(time * 0.47) * 0.12)
    const flicker = Math.sin(time * 8.1) * 0.55 + Math.sin(time * 13.7) * 0.3 + Math.sin(time * 23) * 0.15
    if (flameGroup.current) flameGroup.current.scale.y = 1 + 0.21 * flicker
    if (fireLight.current) fireLight.current.intensity = 4 + flicker * 0.7
  })
  underwater.mesh.material.color.set(white ? underwater.white : underwater.color)
  underwater.mesh.material.emissive.set(underwater.color)
  underwater.mesh.material.emissiveIntensity = white ? 0 : night ? 2.5 : 0.65
  stairLights.mesh.material.color.set(white ? stairLights.white : stairLights.color)
  stairLights.mesh.material.emissive.set(stairLights.color)
  stairLights.mesh.material.emissiveIntensity = night && !white ? 2.2 : 0
  return <>
    <primitive object={stairLights.mesh} />
    {!white && <>
      <primitive object={underwater.mesh} />
      <mesh geometry={waterGeometry}>
        <meshStandardMaterial map={water} color={water ? '#ffffff' : '#2f8fd0'} emissive="#2f8fd0" emissiveMap={water}
          emissiveIntensity={night ? 0.9 : 0.25} roughness={0.22} transparent opacity={0.63} depthWrite={false} />
      </mesh>
      <group ref={flameGroup} position={planToWorld(fireCenter, lounge.floor + 0.30)}>
        <primitive object={flameMesh} />
      </group>
      {night && <>
        <pointLight position={planToWorld(pool.label, waterline + 0.55)} color="#58d5f6" intensity={10} distance={6} />
        <pointLight ref={fireLight} position={planToWorld(fireCenter, lounge.floor + 0.68)}
          color="#ff8237" intensity={4} distance={4} />
      </>}
    </>}
  </>
}

export default function Landscape({ white, night }: { white: boolean; night: boolean }) {
  for (const { mesh, color, white: lightColor } of plantBatches) mesh.material.color.set(white ? lightColor : color)
  return <>
    <Surface geometry={pavingGeometry} white={white} pattern="pavers" color="#cfcac0" floor />
    <Surface geometry={woodGeometry} white={white} pattern="deck" color="#8a7a66" floor />
    <Surface geometry={loungeFloorGeometry} white={white} pattern="pavers" color="#cfcac0" floor />
    <Surface geometry={benchGeometry} white={white} pattern="concrete" color="#bdbab4" />
    <Surface geometry={troughGeometry} white={white} color="#1b1b1b" />
    {!white && <>
      <Surface geometry={copingGeometry} white={false} pattern="concrete" color="#bdbab4" />
      <Surface geometry={basinGeometry} white={false} pattern="poolTile" color="#1f2a30" />
    </>}
    {white && whiteEdges.map((geometry, index) => <lineSegments key={index} geometry={geometry}>
      <lineBasicMaterial color="#596964" transparent opacity={0.31} />
    </lineSegments>)}
    {plantBatches.map(({ mesh, color }) => <primitive key={color} object={mesh} />)}
    <OutdoorEffects white={white} night={night} />
  </>
}

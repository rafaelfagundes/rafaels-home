import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { contains, segments, type Footprint, type Point, type WorldPoint } from '../model/geometry'
import { house } from '../model/house'
import { useApp } from '../model/store'
import { outwardNormals } from '../model/wallFinishes'

export const desktop = matchMedia('(pointer: fine) and (min-width: 800px)').matches
export const touch = matchMedia('(any-pointer: coarse)').matches || navigator.maxTouchPoints > 0

const daylight = { top: new THREE.Color('#8fb3d9'), horizon: new THREE.Color('#e7eef2') }
const dusk = { top: new THREE.Color('#10223f'), horizon: new THREE.Color('#3b4f73') }
const skyGeometry = new THREE.SphereGeometry(1, 24, 12)
const skyMaterial = new THREE.ShaderMaterial({
  uniforms: {
    topColor: { value: daylight.top.clone() },
    horizonColor: { value: daylight.horizon.clone() },
    warmColor: { value: new THREE.Color('#a87e79') },
    warmth: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec3 direction;
    void main() {
      direction = position;
      // Use camera rotation only so the sky remains centered without frame updates.
      gl_Position = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
      gl_Position.z = gl_Position.w;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 topColor, horizonColor, warmColor;
    uniform float warmth;
    varying vec3 direction;
    void main() {
      float height = normalize(direction).y;
      vec3 color = mix(horizonColor, topColor, smoothstep(0.0, 0.85, height));
      float band = 1.0 - smoothstep(0.0, 0.17, abs(height - 0.065));
      gl_FragColor = vec4(mix(color, warmColor, warmth * band), 1.0);
      #include <colorspace_fragment>
    }
  `,
  side: THREE.BackSide,
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
})

function Sky({ night, visible }: { night: boolean; visible: boolean }) {
  const palette = night ? dusk : daylight
  useLayoutEffect(() => {
    skyMaterial.uniforms.topColor.value.copy(palette.top)
    skyMaterial.uniforms.horizonColor.value.copy(palette.horizon)
    skyMaterial.uniforms.warmth.value = night ? 0.24 : 0
  }, [night, palette])
  return <>
    <mesh geometry={skyGeometry} material={skyMaterial} visible={visible} frustumCulled={false}
      renderOrder={-1000} raycast={() => {}} />
    {visible && <fog attach="fog" args={[palette.horizon, night ? 28 : 38, night ? 112 : 140]} />}
  </>
}

function fixtureGrid(zone: Footprint & { label: Point }) {
  const xs = zone.polygon.map(([x]) => x)
  const zs = zone.polygon.map(([, z]) => z)
  const x0 = Math.min(...xs)
  const z0 = Math.min(...zs)
  const width = Math.max(...xs) - x0
  const depth = Math.max(...zs) - z0
  const columns = Math.max(1, Math.round(width / Math.sqrt(3)))
  const rows = Math.max(1, Math.round(depth / Math.sqrt(3)))
  const positions: Point[] = []
  for (let col = 0; col < columns; col++) {
    for (let row = 0; row < rows; row++) {
      const point: Point = [x0 + width * (col + 0.5) / columns, z0 + depth * (row + 0.5) / rows]
      if (contains(zone, point)) positions.push(point)
    }
  }
  if (!positions.length && contains(zone, zone.label)) positions.push(zone.label)
  return positions
}

const eave = house.roof.eave
const underside = house.roof.top - house.roof.slabThickness
const discGeometry = new THREE.CircleGeometry(0.065, 12).rotateX(Math.PI / 2)
const discMaterial = new THREE.MeshStandardMaterial({ color: '#c7bab0', emissive: '#ffd9a0', emissiveIntensity: 0 })
function downlights(positions: WorldPoint[]) {
  const mesh = new THREE.InstancedMesh(discGeometry, discMaterial, positions.length)
  const matrix = new THREE.Matrix4()
  positions.forEach(([x, y, z], index) => mesh.setMatrixAt(index, matrix.makeTranslation(x, y, z)))
  return mesh
}
const ceilingDiscs = downlights(house.rooms.flatMap(zone => {
  if (!zone.indoor || !zone.ceiling) return []
  const ceiling = zone.floor + zone.ceiling
  const offset = zone.key === 'hallway' ? 0.134 : 0.004
  return fixtureGrid(zone).map(([x, z]): WorldPoint => [x, ceiling - offset, z])
}))
const sidePath = house.outdoor.find(zone => zone.key === 'side_path')!
const eaveNormals = outwardNormals(eave)
const sideDiscs: WorldPoint[] = segments(eave).flatMap(([[ax, az], [bx, bz]], index) => {
  const count = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 1.8))
  const [nx, nz] = eaveNormals[index]
  const positions: WorldPoint[] = []
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count
    const x = ax + (bx - ax) * t
    const z = az + (bz - az) * t
    // The roof only overlaps a narrow part of the side path. Tuck discs inside its edge.
    if (contains(sidePath, [x + nx * 0.13, z + nz * 0.13])) {
      positions.push([x - nx * 0.08, underside - 0.004, z - nz * 0.08])
    }
  }
  return positions
})
const coveredDiscs = house.outdoor.filter(zone => ['veranda', 'gourmet', 'garage'].includes(zone.key))
  .flatMap(zone => fixtureGrid(zone).filter(point => contains({ polygon: eave }, point))
    .map(point => ({ point, whiteCeiling: zone.ceiling ? zone.floor + zone.ceiling : underside })))
const soffitDiscs = downlights([
  ...sideDiscs, ...coveredDiscs.map(({ point: [x, z] }): WorldPoint => [x, underside - 0.004, z]),
])
const whiteSoffitDiscs = downlights([
  ...sideDiscs, ...coveredDiscs.map(({ point: [x, z], whiteCeiling }): WorldPoint => [x, whiteCeiling - 0.004, z]),
])

export function Lighting() {
  const { shadows, style, lighting, roofInDollhouse } = useApp(s => s.settings)
  const mode = useApp(s => s.mode)
  const night = lighting === 'night'
  const finished = style === 'finished'
  const walk = mode === 'walk'
  const dayShadow = !night && shadows !== 'off' && (finished || desktop || shadows === 'high')
  const size = desktop && !touch ? 1024 : 512
  const sun = useRef<THREE.DirectionalLight>(null)
  useLayoutEffect(() => {
    if (dayShadow && sun.current) sun.current.shadow.needsUpdate = true
  }, [dayShadow, style, walk, roofInDollhouse])
  useLayoutEffect(() => {
    discMaterial.emissiveIntensity = night ? 2.5 : 0
  }, [night])

  return <>
    <Sky night={night} visible={finished || night} />
    <hemisphereLight color={night ? '#99b6ed' : '#ffffff'} groundColor={night ? '#536180' : '#b1bab6'}
      intensity={night ? 0.62 : 2.12} />
    <directionalLight ref={sun} position={night ? [-8, 15, -10] : [7, 20, 13]}
      color={night ? '#b9ccff' : finished ? '#fff4e6' : '#ffffff'} intensity={night ? 0.32 : 1.7}
      castShadow={dayShadow} shadow-autoUpdate={false}
      shadow-mapSize={[size, size]} shadow-camera-left={-32} shadow-camera-right={32}
      shadow-camera-top={22} shadow-camera-bottom={-22} shadow-camera-far={65}
      shadow-normalBias={0.035} shadow-bias={-0.00015} shadow-radius={3} />
    {walk && !night && <ambientLight intensity={0.28} />}
    <primitive object={ceilingDiscs} visible={walk && (finished || night)} />
    <primitive object={soffitDiscs} visible={walk ? finished : roofInDollhouse && (finished || night)} />
    <primitive object={whiteSoffitDiscs} visible={!finished && night && walk} />
    {night && finished && <>
      <pointLight position={[9.2, 2.83, 8.9]} color="#ffd6a0" intensity={19} distance={6} />
      <pointLight position={[14.2, 2.93, 11.7]} color="#ffcc90" intensity={14} distance={5} />
    </>}
  </>
}

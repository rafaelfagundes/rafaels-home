import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Line, OrbitControls } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { contains, floorElevation, planToWorld, type Point } from '../model/geometry'
import { collision, house, walkingFloors, whiteCollision, zonePose, zones } from '../model/house'
import { dictionary, roomName } from '../model/i18n'
import { useApp } from '../model/store'
import { formatLength } from '../model/units'
import { createFloorOcclusion, edgeLines, layers } from './model'
import { finishedLayers, mullions, whiteEave, whiteEaveLines } from './finishedModel'
import Landscape from './Landscape'
import { getTexture, patterns, type PatternName } from './textures'

const colors = {
  floor: '#dcdedb', paving: '#bec6c5', garden: '#d1dfce', covered: '#d4d7d1',
  wall: '#faf9f3', glass: '#adcbd5', water: '#a5cddb', basin: '#cbdcdd',
  trim: '#a4aeaa', roof: '#faf9f4', ground: '#c8cfca',
}
const floorLayers = new Set(['floor', 'paving', 'garden', 'covered', 'ground'])
const desktop = matchMedia('(pointer: fine) and (min-width: 800px)').matches
const floorOcclusion = desktop ? createFloorOcclusion() : null

const frameGeometry = new THREE.BoxGeometry()
const frameMaterial = new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.7 })
const mullionMesh = new THREE.InstancedMesh(frameGeometry, frameMaterial, mullions.length)
for (const [index, { position, scale }] of mullions.entries()) {
  const matrix = new THREE.Matrix4().makeScale(...scale).setPosition(...position)
  mullionMesh.setMatrixAt(index, matrix)
}
mullionMesh.castShadow = true
mullionMesh.receiveShadow = true
mullionMesh.userData.pick = true

function FinishedArchitecture({ walk, showRoof }: { walk: boolean; showRoof: boolean }) {
  return <>
    {finishedLayers.map(({ part, finish, geometry }) => {
      if ((part === 'ceiling' && !walk) || (part === 'eave' && !showRoof)) return null
      const glass = finish === 'glazing'
      const pattern = patterns[finish as PatternName]
      const map = pattern ? getTexture(finish as PatternName) : null
      const color = map ? '#ffffff' : pattern?.color ?? (glass ? '#9fc6c4' : finish === 'roofDeck' ? '#77746e' : '#151515')
      const roughness = glass ? 0.05 : finish === 'concrete' ? patterns.concrete.roughness : 0.85
      return <mesh key={part + ':' + finish} geometry={geometry} userData={{ pick: true, floor: part === 'floor' }}
        castShadow={!glass && (part === 'wall' || part === 'eave')} receiveShadow={!glass}>
        <meshStandardMaterial color={color} map={map} roughness={roughness} metalness={0}
          transparent={glass} opacity={glass ? 0.25 : 1} depthWrite={!glass} />
      </mesh>
    })}
    <primitive object={mullionMesh} />
  </>
}

function Architecture() {
  const mode = useApp(s => s.mode)
  const { shadows, style, lighting, roofInDollhouse } = useApp(s => s.settings)
  const showRoof = mode === 'walk' || roofInDollhouse
  const finished = style === 'finished'
  return <>
    {finished && <FinishedArchitecture walk={mode === 'walk'} showRoof={showRoof} />}
    {layers.map(([layer, geometry]) => (finished
      ? layer === 'ground'
      : layer !== 'roof' || mode === 'walk') &&
      <mesh key={layer} geometry={geometry} userData={{ pick: true, floor: floorLayers.has(layer) }}
        castShadow={layer === 'wall'} receiveShadow={layer !== 'glass'}>
        <meshStandardMaterial color={colors[layer]} roughness={0.95}
          transparent={layer === 'glass'} opacity={layer === 'glass' ? 0.35 : 1}
          aoMap={shadows !== 'off' && floorLayers.has(layer) ? floorOcclusion : null} aoMapIntensity={0.72}
          depthWrite={layer !== 'glass'} />
      </mesh>
    )}
    <Landscape white={!finished} night={lighting === 'night'} />
    {!finished && <lineSegments geometry={edgeLines}>
      <lineBasicMaterial color="#596964" transparent opacity={0.31} />
    </lineSegments>}
    {!finished && showRoof && <>
      <mesh geometry={whiteEave} userData={{ pick: true }} receiveShadow>
        <meshStandardMaterial color={colors.roof} roughness={0.95} />
      </mesh>
      <lineSegments geometry={whiteEaveLines}>
        <lineBasicMaterial color="#596964" transparent opacity={0.31} />
      </lineSegments>
    </>}
  </>
}

function Lighting() {
  const { shadows: quality, style, lighting, roofInDollhouse } = useApp(s => s.settings)
  const mode = useApp(s => s.mode)
  const night = lighting === 'night'
  const finished = style === 'finished'
  const size = desktop && finished ? 1024 : desktop && quality === 'high' ? 2048 : 512
  const castShadow = quality !== 'off' && (finished || desktop || quality === 'high')
  const light = useRef<THREE.DirectionalLight>(null)
  useEffect(() => {
    if (light.current) light.current.shadow.needsUpdate = castShadow
  }, [castShadow, size, style, mode, roofInDollhouse])
  return <>
    {night && <color attach="background" args={['#3b4f73']} />}
    <hemisphereLight args={night ? ['#acc4f7', '#69728d', 0.8] : ['#ffffff', '#b1bab6', 2.12]} />
    <directionalLight key={size} ref={light} position={[7, 20, 13]}
      color={night ? '#b9ccff' : finished ? '#fff4e6' : '#ffffff'} intensity={night ? 0.35 : 1.7}
      castShadow={castShadow} shadow-autoUpdate={false}
      shadow-mapSize={[size, size]} shadow-camera-left={-32} shadow-camera-right={32}
      shadow-camera-top={22} shadow-camera-bottom={-22} shadow-camera-far={65}
      shadow-normalBias={0.035} shadow-bias={-0.00015} shadow-radius={3} />
    {mode === 'walk' && <ambientLight intensity={night ? 0.12 : 0.28} />}
  </>
}

function Walker() {
  const camera = useThree(s => s.camera)
  const height = useRef<number | undefined>(undefined)
  const version = useRef(-1)
  const keys = useRef(new Set<string>())
  const movementKeys = useMemo(() => new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright']), [])

  useEffect(() => {
    const held = keys.current
    const down = (event: KeyboardEvent) => {
      if (useApp.getState().panel || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea')) return
      const key = event.key.toLowerCase()
      if (!movementKeys.has(key)) return
      event.preventDefault()
      held.add(key)
    }
    const up = (event: KeyboardEvent) => { held.delete(event.key.toLowerCase()) }
    const reset = () => held.clear()
    const unsubscribe = useApp.subscribe((state, previous) => {
      if (state.panel !== previous.panel) reset()
    })
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', reset)
    return () => {
      unsubscribe()
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', reset)
    }
  }, [movementKeys])

  useFrame((_, elapsed) => {
    const state = useApp.getState()
    const { pose, target, joystick, panel, teleportVersion } = state
    const walkCollision = state.settings.style === 'white' ? whiteCollision : collision
    const dt = Math.min(elapsed, 0.05)
    const { heading, pitch } = pose
    const front = Math.cos(heading)
    const side = Math.sin(heading)
    let position = pose.position
    if (!panel) {
      const pressed = (...names: string[]) => Number(names.some(key => keys.current.has(key)))
      const forward = joystick[1] + pressed('w', 'arrowup') - pressed('s', 'arrowdown')
      const right = joystick[0] + pressed('d', 'arrowright') - pressed('a', 'arrowleft')
      const magnitude = Math.max(1, Math.hypot(forward, right))
      const speed = 2.75 * dt
      if (forward || right) {
        position = walkCollision.move(position, [(front * forward - side * right) * speed / magnitude, (side * forward + front * right) * speed / magnitude])
        if (target) useApp.setState({ target: null })
      } else if (target) {
        const dx = target[0] - position[0]
        const dy = target[1] - position[1]
        const distance = Math.hypot(dx, dy)
        const step = Math.min(distance, speed)
        if (distance < 0.025) {
          useApp.setState({ target: null })
        } else if (step > 0) {
          const next = walkCollision.move(position, [dx * step / distance, dy * step / distance])
          // Stop when the direct route is blocked.
          if (Math.hypot(next[0] - position[0] - dx * step / distance, next[1] - position[1] - dy * step / distance) > 1e-6) {
            useApp.setState({ target: null })
          }
          position = next
        }
      }
    }
    if (position[0] !== pose.position[0] || position[1] !== pose.position[1]) {
      useApp.setState({ pose: { ...pose, position } })
    }
    const floor = floorElevation(position, walkingFloors) + house.meta.eyeHeight
    if (height.current === undefined || version.current !== teleportVersion) height.current = floor
    else height.current = THREE.MathUtils.damp(height.current, floor, 16, dt)
    version.current = teleportVersion
    camera.position.set(...planToWorld(position, height.current))
    camera.lookAt(camera.position.x + front * Math.cos(pitch), height.current + Math.sin(pitch), camera.position.z + side * Math.cos(pitch))
  })
  return null
}

function Orbit() {
  const { camera, size } = useThree()
  const target = useMemo(() => new THREE.Vector3(house.lot.width / 2, 0.5, house.lot.depth / 2), [])
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height)
    const distance = 34 / Math.min(1, Math.max(0.3, aspect))
    const offsetX = aspect < 0.75 ? 0.07 : 0.18
    camera.position.copy(target).addScaledVector(new THREE.Vector3(offsetX, 0.94, 0.55).normalize(), distance)
    camera.lookAt(target)
  }, [camera, target, size.width, size.height])
  return <OrbitControls makeDefault target={target} enableDamping dampingFactor={0.12}
    minDistance={3} maxDistance={135} maxPolarAngle={Math.PI / 2 - 0.04} />
}

function Gestures() {
  const { gl, scene, camera } = useThree()

  useEffect(() => {
    const canvas = gl.domElement
    const pointers = new Set<number>()
    const ray = new THREE.Raycaster()
    let gesture: { id: number; x: number; y: number; lastX: number; lastY: number; time: number; drag: boolean } | undefined
    const down = (event: PointerEvent) => {
      pointers.add(event.pointerId)
      if (pointers.size !== 1 || event.button !== 0) {
        gesture = undefined
        return
      }
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, time: performance.now(), drag: false }
      if (useApp.getState().mode === 'walk') canvas.setPointerCapture(event.pointerId)
    }
    const move = (event: PointerEvent) => {
      if (gesture?.id !== event.pointerId) return
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 7) gesture.drag = true
      const { mode, panel, pose } = useApp.getState()
      if (mode === 'walk' && !panel && gesture.drag) {
        useApp.setState({ pose: {
          ...pose,
          heading: pose.heading - (event.clientX - gesture.lastX) * 0.004,
          pitch: THREE.MathUtils.clamp(pose.pitch + (event.clientY - gesture.lastY) * 0.004, -1.38, 1.38),
        } })
      }
      gesture.lastX = event.clientX
      gesture.lastY = event.clientY
    }
    const cancel = (event: PointerEvent) => {
      pointers.delete(event.pointerId)
      if (gesture?.id === event.pointerId) gesture = undefined
    }
    const up = (event: PointerEvent) => {
      const last = gesture
      cancel(event)
      const { measuring, mode, panel, addPoint, settings } = useApp.getState()
      if (panel || last?.id !== event.pointerId || last.drag || performance.now() - last.time > 500) return
      const bounds = canvas.getBoundingClientRect()
      ray.setFromCamera(new THREE.Vector2(
        (event.clientX - bounds.left) / bounds.width * 2 - 1,
        1 - (event.clientY - bounds.top) / bounds.height * 2,
      ), camera)
      const hit = ray.intersectObjects(scene.children, true).find(hit => hit.object.userData.pick)
      if (!hit) return
      if (measuring) {
        addPoint(hit.point.toArray())
      } else if (hit.object.userData.floor) {
        const target: Point = [hit.point.x, hit.point.z]
        const walkCollision = settings.style === 'white' ? whiteCollision : collision
        if (mode === 'walk' && walkCollision.isFree(target)) useApp.setState({ target })
        if (mode === 'dollhouse' && hit.face && hit.face.normal.y > 0.5) {
          const room = house.rooms.find(zone => contains(zone, target))
          if (room) {
            const { position, heading } = zonePose(room, walkCollision)
            useApp.getState().jump(position, heading)
          }
        }
      }
    }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    return () => {
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
  }, [camera, gl, scene])
  return null
}

function Annotations() {
  const { language, units, labels } = useApp(s => s.settings)
  const mode = useApp(s => s.mode)
  const points = useApp(s => s.points)
  const target = useApp(s => s.target)
  const [a, b] = points
  return <>
    {target && mode === 'walk' && <mesh position={planToWorld(target, floorElevation(target, walkingFloors) + 0.022)} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.18, 0.225, 32]} />
      <meshBasicMaterial color="#32635a" side={THREE.DoubleSide} />
    </mesh>}
    {labels && mode === 'dollhouse' && zones.map(zone => (
      <Html key={zone.id} center position={planToWorld(zone.label, zone.floor + (zone.indoor ? 1.5 : 0.35))}
        style={{ pointerEvents: 'none' }} occlude>
        <span className="model-label">{roomName(zone, language)}</span>
      </Html>
    ))}
    {points.map((point, index) => <mesh key={index} position={point} renderOrder={10}>
      <sphereGeometry args={[0.057, 12, 8]} />
      <meshBasicMaterial color="#285e52" depthTest={false} />
    </mesh>)}
    {a && b && <>
      <Line points={[a, b]} color="#285e52" lineWidth={2.5} depthTest={false} renderOrder={9} />
      <Html center position={new THREE.Vector3(...a).lerp(new THREE.Vector3(...b), 0.5)}
        style={{ pointerEvents: 'none' }}>
        <span className="distance-label">{formatLength(new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b)), units, language)}</span>
      </Html>
    </>}
  </>
}

export default function Scene() {
  const mode = useApp(s => s.mode)
  const language = useApp(s => s.settings.language)
  return <Canvas dpr={[1, 2]} shadows camera={{ fov: 55, near: 0.035, far: 180 }}
    fallback={<p className="loading">{dictionary[language].unavailable}</p>}>
    <Lighting />
    <Architecture />
    {mode === 'walk' ? <Walker /> : <Orbit />}
    <Gestures />
    <Annotations />
  </Canvas>
}

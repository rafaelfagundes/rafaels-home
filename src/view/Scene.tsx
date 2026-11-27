import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Line, OrbitControls, PerformanceMonitor } from '@react-three/drei'
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'
import { contains, floorElevation, planToWorld, type Point } from '../model/geometry'
import { house, safePosition, walkCollisionFor, walkingFloors, zonePose, zones } from '../model/house'
import { dictionary, roomName } from '../model/i18n'
import { useApp } from '../model/store'
import { palette } from '../model/palette'
import { formatLength } from '../model/units'
import { createFloorOcclusion, edgeLines, layers } from './model'
import { finishedLayers, mullions, whiteEave, whiteEaveLines } from './finishedModel'
import Landscape from './Landscape'
import PersonFigure from './Person'
import { desktop, Lighting, touch } from './Lighting'
import { getTexture, patterns, type PatternName } from './textures'

const Furniture = lazy(() => import('./Furniture'))
const Vehicles = lazy(() => import('./Vehicles'))

const maxDpr = THREE.MathUtils.clamp(window.devicePixelRatio, 1, 2)
const initialDpr = touch ? Math.min(1.5, maxDpr) : maxDpr
const rendererOptions = { toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace }
const performanceBounds = (refresh: number): [number, number] => refresh > 90 ? [50, 85] : [35, 55]

const colors = {
  floor: '#dcdedb', paving: '#bec6c5', garden: '#d1dfce', covered: '#d4d7d1',
  wall: '#faf9f3', glass: '#adcbd5', water: '#a5cddb', basin: '#cbdcdd',
  trim: '#a4aeaa', roof: '#faf9f4', ground: '#c8cfca',
}
const floorLayers = new Set(['floor', 'paving', 'garden', 'covered', 'ground'])
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

const warmFinishes = new Set(['plaster', 'stoneTile', 'feature', 'concrete', 'ceilingWood'])

function FinishedArchitecture({ walk, showRoof, night }: { walk: boolean; showRoof: boolean; night: boolean }) {
  return <>
    {finishedLayers.map(({ part, finish, geometry }) => {
      if ((part === 'ceiling' && !walk) || (part === 'eave' && !showRoof)) return null
      const glass = finish === 'glazing'
      const pattern = patterns[finish as PatternName]
      const map = pattern ? getTexture(finish as PatternName) : null
      const color = map ? '#ffffff' : pattern?.color ?? (glass ? '#9fc6c4' : finish === 'roofDeck' ? '#77746e' : '#151515')
      const warm = warmFinishes.has(finish)
      const roughness = glass ? 0.05 : finish === 'concrete' ? patterns.concrete.roughness : 0.85
      return <mesh key={part + ':' + finish} geometry={geometry} userData={{ pick: true, floor: part === 'floor' }}
        castShadow={!glass && (part === 'wall' || part === 'eave')} receiveShadow={!glass}>
        <meshStandardMaterial color={color} map={map} roughness={roughness} metalness={0}
          emissive="#ffd2a2" emissiveMap={warm ? map : null} emissiveIntensity={night && warm ? 0.25 : 0}
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
    {finished && <FinishedArchitecture walk={mode === 'walk'} showRoof={showRoof} night={lighting === 'night'} />}
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

function Walker() {
  const camera = useThree(s => s.camera)
  const height = useRef<number | undefined>(undefined)
  const floorSample = useRef<{ x: number; z: number; eye: number }>({ x: NaN, z: NaN, eye: 0 })
  const version = useRef(-1)
  const keys = useRef(new Set<string>())
  const movementKeys = useMemo(() => new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright']), [])

  useEffect(() => {
    const held = keys.current
    const down = (event: KeyboardEvent) => {
      const { panel, controlsHidden } = useApp.getState()
      if ((panel && !controlsHidden) || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea')) return
      const key = event.key.toLowerCase()
      if (!movementKeys.has(key)) return
      event.preventDefault()
      held.add(key)
    }
    const up = (event: KeyboardEvent) => { held.delete(event.key.toLowerCase()) }
    const reset = () => held.clear()
    const unsubscribe = useApp.subscribe((state, previous) => {
      if (state.panel !== previous.panel || state.controlsHidden !== previous.controlsHidden) reset()
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
    const { pose, target, joystick, panel, controlsHidden, teleportVersion } = state
    const walkCollision = walkCollisionFor(state.settings)
    const dt = Math.min(elapsed, 0.05)
    const { heading, pitch } = pose
    const front = Math.cos(heading)
    const side = Math.sin(heading)
    let position = pose.position
    if (!panel || controlsHidden) {
      const held = keys.current
      const forward = joystick[1] + Number(held.has('w') || held.has('arrowup')) - Number(held.has('s') || held.has('arrowdown'))
      const right = joystick[0] + Number(held.has('d') || held.has('arrowright')) - Number(held.has('a') || held.has('arrowleft'))
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
      state.setPose({ ...pose, position })
    }
    const sample = floorSample.current
    if (position[0] !== sample.x || position[1] !== sample.z) {
      sample.x = position[0]
      sample.z = position[1]
      sample.eye = floorElevation(position, walkingFloors) + house.meta.eyeHeight
    }
    const floor = sample.eye
    if (height.current === undefined || version.current !== teleportVersion) height.current = floor
    else height.current = THREE.MathUtils.damp(height.current, floor, 16, dt)
    version.current = teleportVersion
    camera.position.set(position[0], height.current, position[1])
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
  const { gl, scene, camera, controls } = useThree()

  useEffect(() => {
    const canvas = gl.domElement
    const pointers = new Set<number>()
    const ray = new THREE.Raycaster()
    const screen = new THREE.Vector2()
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0))
    const hitPoint = new THREE.Vector3()
    const orbit = controls && 'enabled' in controls ? controls : null
    const cursor = canvas.style.cursor
    let personDrag: { id: number; offset: Point; start: Point; moved: boolean } | undefined

    function aim(event: PointerEvent) {
      const bounds = canvas.getBoundingClientRect()
      screen.set((event.clientX - bounds.left) / bounds.width * 2 - 1,
        1 - (event.clientY - bounds.top) / bounds.height * 2)
      ray.setFromCamera(screen, camera)
    }
    function pick(event: PointerEvent) {
      aim(event)
      return ray.intersectObjects(scene.children, true).find(hit => hit.object.userData.pick || hit.object.userData.person)
    }
    function project(position: Point) {
      plane.constant = -floorElevation(position, walkingFloors)
      return ray.ray.intersectPlane(plane, hitPoint)
    }
    function endDrag() {
      if (!personDrag) return
      const { id } = personDrag
      personDrag = undefined
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id)
      if (orbit) orbit.enabled = true
      canvas.style.cursor = cursor
    }

    let gesture: { id: number; x: number; y: number; lastX: number; lastY: number; time: number; drag: boolean } | undefined
    const down = (event: PointerEvent) => {
      if (personDrag) {
        event.stopImmediatePropagation()
        return
      }
      const { mode, panel, controlsHidden, person } = useApp.getState()
      if (mode === 'dollhouse' && (!panel || controlsHidden) && !pointers.size && event.button === 0 &&
        pick(event)?.object.userData.person) {
        event.stopImmediatePropagation()
        const point = project(person.position)
        if (!point) return
        personDrag = {
          id: event.pointerId, offset: [person.position[0] - point.x, person.position[1] - point.z],
          start: [event.clientX, event.clientY], moved: false,
        }
        if (orbit) orbit.enabled = false
        canvas.style.cursor = 'grabbing'
        canvas.setPointerCapture(event.pointerId)
        return
      }
      pointers.add(event.pointerId)
      if (pointers.size !== 1 || event.button !== 0) {
        gesture = undefined
        return
      }
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, time: performance.now(), drag: false }
      if (mode === 'walk') canvas.setPointerCapture(event.pointerId)
    }
    const move = (event: PointerEvent) => {
      const { mode, panel, controlsHidden, person, pose, setPose, movePerson } = useApp.getState()
      if (personDrag?.id === event.pointerId) {
        if (mode !== 'dollhouse' || (panel && !controlsHidden)) {
          endDrag()
          return
        }
        const [startX, startY] = personDrag.start
        if (!personDrag.moved && Math.hypot(event.clientX - startX, event.clientY - startY) < 3) return
        personDrag.moved = true
        aim(event)
        const point = project(person.position)
        if (point && point.distanceToSquared(ray.ray.origin) <= 180 ** 2) {
          movePerson([point.x + personDrag.offset[0], point.z + personDrag.offset[1]])
        }
        return
      }
      if (!pointers.size && event.pointerType === 'mouse') {
        canvas.style.cursor = mode === 'dollhouse' && (!panel || controlsHidden) &&
          pick(event)?.object.userData.person ? 'grab' : cursor
      }
      if (gesture?.id !== event.pointerId) return
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 7) gesture.drag = true
      if (mode === 'walk' && (!panel || controlsHidden) && gesture.drag) {
        setPose({
          ...pose,
          heading: pose.heading - (event.clientX - gesture.lastX) * 0.004,
          pitch: THREE.MathUtils.clamp(pose.pitch + (event.clientY - gesture.lastY) * 0.004, -1.38, 1.38),
        })
      }
      gesture.lastX = event.clientX
      gesture.lastY = event.clientY
    }
    const cancel = (event: PointerEvent) => {
      if (personDrag?.id === event.pointerId) endDrag()
      pointers.delete(event.pointerId)
      if (gesture?.id === event.pointerId) gesture = undefined
    }
    const up = (event: PointerEvent) => {
      const last = gesture
      cancel(event)
      const { measuring, mode, panel, controlsHidden, addPoint, settings } = useApp.getState()
      if ((panel && !controlsHidden) || last?.id !== event.pointerId || last.drag || performance.now() - last.time > 500) return
      const hit = pick(event)
      if (!hit || hit.object.userData.person) return
      if (measuring && !controlsHidden) {
        addPoint(hit.point.toArray())
      } else if (hit.object.userData.floor) {
        const target: Point = [hit.point.x, hit.point.z]
        const walkCollision = walkCollisionFor(settings)
        if (mode === 'walk') {
          const position = safePosition(target, undefined, walkCollision)
          if (position) useApp.setState({ target: position })
        }
        if (mode === 'dollhouse' && hit.face && hit.face.normal.y > 0.5) {
          const room = house.rooms.find(zone => contains(zone, target))
          if (room) {
            const { position, heading } = zonePose(room, walkCollision)
            useApp.getState().jump(position, heading)
          }
        }
      }
    }
    const leave = () => { if (!personDrag) canvas.style.cursor = cursor }
    const unsubscribe = useApp.subscribe(state => {
      if (state.mode !== 'dollhouse' || (state.panel && !state.controlsHidden)) endDrag()
    })
    canvas.addEventListener('pointerdown', down, true)
    canvas.addEventListener('pointerleave', leave)
    canvas.addEventListener('lostpointercapture', cancel)
    canvas.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    return () => {
      unsubscribe()
      endDrag()
      canvas.style.cursor = cursor
      canvas.removeEventListener('pointerdown', down, true)
      canvas.removeEventListener('pointerleave', leave)
      canvas.removeEventListener('lostpointercapture', cancel)
      canvas.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
  }, [camera, controls, gl, scene])
  return null
}

function Annotations({ portal }: { portal: RefObject<HTMLDivElement | null> }) {
  const { language, units, labels } = useApp(s => s.settings)
  const mode = useApp(s => s.mode)
  const points = useApp(s => s.points)
  const target = useApp(s => s.target)
  const controlsHidden = useApp(s => s.controlsHidden)
  const [a, b] = controlsHidden ? [] : points
  if (!portal.current) return null
  // Keep the Html target stable while the canvas connects its event handlers.
  const htmlPortal = { current: portal.current }
  return <>
    {!controlsHidden && target && mode === 'walk' && <group position={planToWorld(target, floorElevation(target, walkingFloors) + 0.022)} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <ringGeometry args={[0.156, 0.174, 32]} />
        <meshBasicMaterial color={palette.cream} toneMapped={false} fog={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.174, 0.192, 32]} />
        <meshBasicMaterial color={palette['near-black']} toneMapped={false} fog={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.192, 0.224, 32]} />
        <meshBasicMaterial color={palette.orange} toneMapped={false} fog={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.224, 0.242, 32]} />
        <meshBasicMaterial color={palette['near-black']} toneMapped={false} fog={false} />
      </mesh>
    </group>}
    {labels && mode === 'dollhouse' && zones.map(zone => (
      <Html key={zone.id} portal={htmlPortal} center position={planToWorld(zone.label, zone.floor + (zone.indoor ? 1.5 : 0.35))}
        style={{ pointerEvents: 'none' }} occlude>
        <span className="model-label">{roomName(zone, language)}</span>
      </Html>
    ))}
    {!controlsHidden && points.map((point, index) => <group key={index} position={point}>
      <mesh renderOrder={11}>
        <sphereGeometry args={[0.083, 12, 8]} />
        <meshBasicMaterial color={palette.cream} depthTest={false} toneMapped={false} fog={false} />
      </mesh>
      <mesh renderOrder={12}>
        <sphereGeometry args={[0.07, 12, 8]} />
        <meshBasicMaterial color={palette['near-black']} depthTest={false} toneMapped={false} fog={false} />
      </mesh>
      <mesh renderOrder={13}>
        <sphereGeometry args={[0.057, 12, 8]} />
        <meshBasicMaterial color={palette.orange} depthTest={false} toneMapped={false} fog={false} />
      </mesh>
    </group>)}
    {a && b && <>
      <Line points={[a, b]} color={palette.cream} lineWidth={6.5} depthTest={false} toneMapped={false} fog={false} renderOrder={8} />
      <Line points={[a, b]} color={palette['near-black']} lineWidth={4.5} depthTest={false} toneMapped={false} fog={false} renderOrder={9} />
      <Line points={[a, b]} color={palette.orange} lineWidth={2.5} depthTest={false} toneMapped={false} fog={false} renderOrder={10} />
      <Html portal={htmlPortal} center position={new THREE.Vector3(...a).lerp(new THREE.Vector3(...b), 0.5)}
        style={{ pointerEvents: 'none' }}>
        <span className="distance-label">{formatLength(new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b)), units, language)}</span>
      </Html>
    </>}
  </>
}

function RenderStats({ output, language }: { output: RefObject<HTMLDivElement | null>; language: keyof typeof dictionary }) {
  const sample = useRef({ frames: 0, seconds: 0 })
  const t = dictionary[language]
  useFrame(({ gl }, delta) => {
    const current = sample.current
    current.frames++
    current.seconds += delta
    if (current.seconds < 1) return
    const { calls, triangles } = gl.info.render
    if (output.current) {
      output.current.textContent = `${Math.round(current.frames / current.seconds)} FPS · ${calls} ${t.drawCalls} · ${triangles} ${t.triangles} · ${gl.getPixelRatio().toFixed(2)} DPR`
    }
    current.frames = 0
    current.seconds = 0
  })
  return null
}

function Furnishings() {
  const furniture = useApp(s => s.settings.furniture)
  const vehicles = useApp(s => s.settings.vehicles)
  const [ready, setReady] = useState(false)
  const frame = useRef<number | null>(null)

  useFrame(() => {
    if (!ready && frame.current === null) {
      // useFrame runs before the render. Wait for the next animation frame.
      frame.current = requestAnimationFrame(() => setReady(true))
    }
  })
  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
  }, [])

  return <>
    {ready && furniture && <Suspense fallback={null}><Furniture /></Suspense>}
    {ready && vehicles && <Suspense fallback={null}><Vehicles /></Suspense>}
  </>
}

export default function Scene({ labelsPortal, stats }: {
  labelsPortal: RefObject<HTMLDivElement | null>
  stats?: RefObject<HTMLDivElement | null>
}) {
  const mode = useApp(s => s.mode)
  const language = useApp(s => s.settings.language)
  const whiteDay = useApp(s => s.settings.style === 'white' && s.settings.lighting === 'day')
  const [dpr, setDpr] = useState(initialDpr)
  // The white Walk scene has no sky mesh and uses its original horizon backdrop.
  const background = mode === 'walk' && whiteDay ? 'linear-gradient(170deg, #dce5e7, #f5f6f1 70%)' : undefined
  return <Canvas style={{ background }} dpr={dpr} gl={rendererOptions} shadows camera={{ fov: 55, near: 0.035, far: 180 }}
    fallback={<p className="loading">{dictionary[language].unavailable}</p>}>
    {maxDpr > 1 && <PerformanceMonitor bounds={performanceBounds}
      onIncline={() => setDpr(value => Math.min(maxDpr, value + 0.25))}
      onDecline={() => setDpr(value => Math.max(1, value - 0.25))} />}
    {stats && <RenderStats output={stats} language={language} />}
    <Lighting />
    <Architecture />
    <Furnishings />
    {mode === 'walk' ? <Walker /> : <><Orbit /><PersonFigure /></>}
    <Gestures />
    <Annotations portal={labelsPortal} />
  </Canvas>
}

import { BufferAttribute, Color, LatheGeometry, MeshStandardMaterial, SphereGeometry, Vector2, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { floorElevation, planToWorld } from '../model/geometry'
import { walkingFloors } from '../model/house'
import { PERSON_HEIGHT } from '../model/person'
import { useApp } from '../model/store'
import { useFurnishingShadows, whiteFurnishing } from './furnishingPlacement'

const body = new Color('#e9e4da')
const trousers = new Color('#8a8f8c')
const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })

export function buildPersonGeometry() {
  const parts: BufferGeometry[] = []
  function add(part: BufferGeometry, color: Color) {
    const colors = new BufferAttribute(new Float32Array(part.attributes.position.count * 3), 3)
    for (let index = 0; index < colors.count; index++) colors.setXYZ(index, color.r, color.g, color.b)
    part.setAttribute('color', colors)
    parts.push(part)
  }
  function oval(color: Color, radii: [number, number, number], center: [number, number, number], tilt = 0) {
    add(new SphereGeometry(1, 10, 8).scale(...radii).rotateZ(tilt).translate(...center), color)
  }

  // The mannequin's local front is +z.
  add(new LatheGeometry([
    [0, 0.91], [0.12, 0.92], [0.145, 0.99], [0.134, 1.08], [0.155, 1.25],
    [0.162, 1.34], [0.14, 1.40], [0.062, 1.445], [0, 1.445],
  ].map(([radius, y]) => new Vector2(radius, y)), 12).scale(1, 1, 0.65), body)
  oval(body, [0.052, 0.075, 0.05], [0, 1.444, 0])
  oval(body, [0.088, 0.112, 0.087], [0, PERSON_HEIGHT - 0.112, 0])
  oval(body, [0.021, 0.029, 0.025], [0, 1.58, 0.078])
  oval(trousers, [0.145, 0.12, 0.099], [0, 0.915, 0])
  for (const side of [-1, 1]) {
    oval(body, [0.046, 0.185, 0.047], [side * 0.169, 1.215, 0], side * 0.11)
    oval(body, [0.038, 0.155, 0.04], [side * 0.195, 0.955, 0.008], side * 0.07)
    oval(body, [0.035, 0.061, 0.036], [side * 0.206, 0.80, 0.024])
    oval(trousers, [0.068, 0.255, 0.076], [side * 0.073, 0.71, 0])
    oval(trousers, [0.053, 0.253, 0.058], [side * 0.085, 0.29, 0])
    oval(trousers, [0.054, 0.047, 0.112], [side * 0.085, 0.047, 0.05])
  }
  const geometry = mergeGeometries(parts)
  parts.forEach(part => part.dispose())
  return geometry
}

const geometry = buildPersonGeometry()

export default function PersonFigure() {
  const person = useApp(s => s.person)
  const { style, shadows } = useApp(s => s.settings)
  const { position, heading } = person
  useFurnishingShadows(person)
  return <mesh geometry={geometry} material={style === 'white' ? whiteFurnishing : material}
    position={planToWorld(position, floorElevation(position, walkingFloors))}
    rotation={[0, Math.PI / 2 - heading, 0]} userData={{ person: true }}
    castShadow={shadows !== 'off'} dispose={null} />
}

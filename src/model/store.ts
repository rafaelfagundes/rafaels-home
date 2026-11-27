import { house, safePosition, walkCollisionFor } from './house'
import { useLayout } from './layoutStore'
import { create } from 'zustand'
import type { Point, WorldPoint } from './geometry'
import { entryPosition, loadPerson, persistPerson, type Person } from './person'
import { parseWalkLink, type Pose } from './walkLink'
import { helpSeen, loadSettings, rememberHelp, saveSettings, type Mode, type Settings } from './settings'

export type Panel = 'rooms' | 'settings' | 'help' | 'plan' | 'layouts'
const CONTROLS_KEY = 'rafaels-home:controls-hidden'

interface State {
  mode: Mode
  panel: Panel | null
  settings: Settings
  pose: Pose
  person: Person
  controlsHidden: boolean
  teleportVersion: number
  target: Point | null
  joystick: Point
  measuring: boolean
  points: WorldPoint[]
  setMode: (mode: Mode) => void
  setPanel: (panel: Panel | null) => void
  setPose: (pose: Pose) => void
  movePerson: (candidate: Point) => void
  toggleControls: () => void
  changeSettings: (settings: Partial<Settings>) => void
  jump: (position: Point, heading: number) => void
  toggleMeasure: () => void
  addPoint: (point: WorldPoint) => void
}

function loadControlsHidden() {
  try { return localStorage.getItem(CONTROLS_KEY) === '1' } catch { return false }
}

function personFromPose({ position, heading }: Pose): Person {
  return { position, heading }
}

function fitPerson(person: Person, collision: ReturnType<typeof walkCollisionFor>): Person {
  const position = safePosition(person.position, undefined, collision) ?? safePosition(entryPosition, undefined, collision) ??
    house.rooms.map(room => room.label).find(collision.isFree) ?? entryPosition
  return position === person.position ? person : { ...person, position }
}

const settings = loadSettings()
const walkCollision = walkCollisionFor(settings)
const linkedPose = parseWalkLink(typeof window === 'undefined' ? '' : window.location.search)
const initialPose = linkedPose && walkCollision.isFree(linkedPose.position) ? linkedPose : undefined
const person = initialPose ? personFromPose(initialPose) : fitPerson(loadPerson(() => true, undefined, useLayout.getState().person), walkCollision)

export const useApp = create<State>((set, get) => ({
  mode: initialPose ? 'walk' : settings.startView,
  panel: initialPose || helpSeen() ? null : 'help',
  settings,
  person,
  pose: initialPose ?? { ...person, pitch: 0 },
  controlsHidden: loadControlsHidden(),
  teleportVersion: 0,
  target: null,
  joystick: [0, 0],
  measuring: false,
  points: [],
  setMode: mode => set(state => {
    if (state.mode === mode) return state
    const person = mode === 'walk' ? fitPerson(state.person, walkCollisionFor(state.settings)) : state.person
    return {
      mode, person, target: null, joystick: [0, 0],
      ...(mode === 'walk' && { pose: { ...person, pitch: 0 }, teleportVersion: state.teleportVersion + 1 }),
    }
  }),
  setPanel: panel => {
    if (get().panel === 'help' && panel !== 'help') rememberHelp()
    set({ panel, joystick: [0, 0] })
  },
  setPose: pose => set(state => ({
    pose,
    person: pose.position === state.person.position && pose.heading === state.person.heading ? state.person : personFromPose(pose),
  })),
  movePerson: candidate => {
    const { person, settings } = get()
    const position = safePosition(candidate, person.position, walkCollisionFor(settings))
    if (!position) return
    const dx = position[0] - person.position[0]
    const dy = position[1] - person.position[1]
    if (!dx && !dy) return
    const heading = Math.atan2(dy, dx)
    set({ person: { position, heading }, pose: { position, heading, pitch: 0 } })
  },
  toggleControls: () => {
    const controlsHidden = !get().controlsHidden
    try { localStorage.setItem(CONTROLS_KEY, controlsHidden ? '1' : '0') } catch { /* Session-only preference. */ }
    set({ controlsHidden, joystick: [0, 0] })
  },
  changeSettings: patch => {
    const { mode, person, pose, settings: previous, target, teleportVersion } = get()
    const settings = { ...previous, ...patch }
    const walkCollision = walkCollisionFor(settings)
    saveSettings(settings)
    const activePosition = mode === 'walk' ? pose.position : person.position
    if (walkCollision !== walkCollisionFor(previous) && !walkCollision.isFree(activePosition)) {
      const position = safePosition(activePosition, undefined, walkCollision) ?? entryPosition
      set({ settings, person: { ...person, position }, pose: { ...pose, position }, target: null, teleportVersion: teleportVersion + 1 })
      return
    }
    set({ settings, target: target && walkCollision.isFree(target) ? target : null })
  },
  jump: (position, heading) => set(state => ({
    mode: 'walk', panel: null, target: null, joystick: [0, 0],
    person: { position, heading }, pose: { position, heading, pitch: 0 }, teleportVersion: state.teleportVersion + 1,
  })),
  toggleMeasure: () => set(state => ({ measuring: !state.measuring, target: null, points: [] })),
  addPoint: point => set(state => ({ points: state.points.length === 1 ? [...state.points, point] : [point] })),
}))

if (typeof window !== 'undefined') {
  const scheduleSave = persistPerson(() => useApp.getState().person)
  useApp.subscribe((state, previous) => {
    if (state.person !== previous.person) scheduleSave()
  })
  if (initialPose) scheduleSave()
}

useLayout.subscribe((state, previous) => {
  if (state.activation === previous.activation) return
  const app = useApp.getState()
  const chosen = state.person ?? { position: entryPosition, heading: 0 }
  const person = fitPerson(chosen, walkCollisionFor(app.settings))
  useApp.setState({ person, pose: { ...person, pitch: 0 }, target: null, teleportVersion: app.teleportVersion + 1 })
})

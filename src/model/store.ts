import { safePosition, walkCollisionFor } from './house'
import { create } from 'zustand'
import type { Point, WorldPoint } from './geometry'
import { parseWalkLink, type Pose } from './walkLink'
import { helpSeen, loadSettings, rememberHelp, saveSettings, type Settings } from './settings'

export type Mode = 'walk' | 'dollhouse'
export type Panel = 'rooms' | 'settings' | 'help' | 'plan'

interface State {
  mode: Mode
  panel: Panel | null
  settings: Settings
  pose: Pose
  teleportVersion: number
  target: Point | null
  joystick: Point
  measuring: boolean
  points: WorldPoint[]
  setMode: (mode: Mode) => void
  setPanel: (panel: Panel | null) => void
  changeSettings: (settings: Partial<Settings>) => void
  jump: (position: Point, heading: number) => void
  toggleMeasure: () => void
  addPoint: (point: WorldPoint) => void
}

const settings = loadSettings()
const walkCollision = walkCollisionFor(settings)
const linkedPose = parseWalkLink(typeof window === 'undefined' ? '' : window.location.search)
const entryPosition: Point = [3.75, 12.3]
const initialPose = linkedPose && walkCollision.isFree(linkedPose.position) ? linkedPose : undefined

export const useApp = create<State>((set, get) => ({
  mode: 'walk',
  panel: initialPose || helpSeen() ? null : 'help',
  settings,
  pose: initialPose ?? { position: entryPosition, heading: 0, pitch: 0 },
  teleportVersion: 0,
  target: null,
  joystick: [0, 0],
  measuring: false,
  points: [],
  setMode: mode => set({ mode, target: null, joystick: [0, 0] }),
  setPanel: panel => {
    if (get().panel === 'help' && panel !== 'help') rememberHelp()
    set({ panel, joystick: [0, 0] })
  },
  changeSettings: patch => {
    const { pose, settings: previous, target, teleportVersion } = get()
    const settings = { ...previous, ...patch }
    const walkCollision = walkCollisionFor(settings)
    saveSettings(settings)
    if (walkCollision !== walkCollisionFor(previous) && !walkCollision.isFree(pose.position)) {
      const position = safePosition(pose.position, undefined, walkCollision) ?? entryPosition
      set({ settings, pose: { ...pose, position }, target: null, teleportVersion: teleportVersion + 1 })
      return
    }
    set({ settings, target: target && walkCollision.isFree(target) ? target : null })
  },
  jump: (position, heading) => set(state => ({
    mode: 'walk', panel: null, target: null, joystick: [0, 0],
    pose: { position, heading, pitch: 0 }, teleportVersion: state.teleportVersion + 1,
  })),
  toggleMeasure: () => set(state => ({ measuring: !state.measuring, target: null, points: [] })),
  addPoint: point => set(state => ({ points: state.points.length === 1 ? [...state.points, point] : [point] })),
}))

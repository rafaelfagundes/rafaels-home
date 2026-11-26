import { collision, safePosition } from './house'
import { create } from 'zustand'
import type { Point, WorldPoint } from './geometry'
import { helpSeen, loadSettings, rememberHelp, saveSettings, type Settings } from './settings'

export type Mode = 'walk' | 'dollhouse'
export type Panel = 'rooms' | 'settings' | 'help' | 'plan'
export interface Pose { position: Point; heading: number; pitch: number }

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

export const useApp = create<State>((set, get) => ({
  mode: 'walk',
  panel: helpSeen() ? null : 'help',
  settings: loadSettings(),
  pose: { position: [3.75, 12.3], heading: 0, pitch: 0 },
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
    const settings = { ...get().settings, ...patch }
    saveSettings(settings)
    const { pose, settings: previous } = get()
    if (previous.style === 'white' && settings.style === 'finished' && !collision.isFree(pose.position)) {
      const position = safePosition(pose.position)
      if (position) {
        set({ settings, pose: { ...pose, position }, target: null })
        return
      }
    }
    set({ settings })
  },
  jump: (position, heading) => set(state => ({
    mode: 'walk', panel: null, target: null, joystick: [0, 0],
    pose: { position, heading, pitch: 0 }, teleportVersion: state.teleportVersion + 1,
  })),
  toggleMeasure: () => set(state => ({ measuring: !state.measuring, target: null, points: [] })),
  addPoint: point => set(state => ({ points: state.points.length === 1 ? [...state.points, point] : [point] })),
}))

import type { Point } from './geometry'

export interface Pose { position: Point; heading: number; pitch: number }

export function parseWalkLink(search: string): Pose | undefined {
  const coordinates = new URLSearchParams(search).get('at')?.split(',')
  if (!coordinates || (coordinates.length !== 3 && coordinates.length !== 4)) return
  if (!coordinates.every(value => /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))) return

  const [x, y, heading, pitch = 0] = coordinates.map(Number)
  if (![x, y, heading, pitch].every(Number.isFinite) || Math.abs(pitch) > 90) return

  return { position: [x, y], heading: (heading % 360) * (Math.PI / 180), pitch: pitch * (Math.PI / 180) }
}

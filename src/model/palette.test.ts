import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { palette, themes } from './palette'

type Color = keyof typeof palette
type Role = keyof typeof themes.day
type Pair = [use: string, foreground: Role | Color, background: Role | Color, minimum: number]

function luminance(hex: string) {
  const channels = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
  const [red, green, blue] = channels.map(channel =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrast(a: string, b: string) {
  const first = luminance(a)
  const second = luminance(b)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

const pairs: Pair[] = [
  ['Default text and icons, loading, model and plan labels', 'foreground', 'surface', 4.5],
  ['Secondary text and icons, disabled Clear', 'secondary', 'surface', 4.5],
  ['Text, icons and pressed inset on hovered controls', 'foreground', 'hover', 4.5],
  ['Room area and control borders on hover', 'secondary', 'hover', 4.5],
  ['Active/primary text, icons and inset, check mark, distance, stats, selection', 'on-active', 'active', 4.5],
  ['Borders, control outlines, joystick rim and track', 'secondary', 'surface', 3],
  ['Active button and checkbox boundary, joystick knob', 'active', 'surface', 3],
  ['Focus ring', 'orange', 'surface', 3],
  ['Restore focus and marker outline', 'cream', 'near-black', 3],
  ['Marker fill and restore focus ring against its dark outer edge', 'orange', 'near-black', 3],
  ['Plan walls, openings and features against rooms', 'plan-wall', 'plan-room', 3],
  ['Plan boundaries and features against land', 'plan-wall', 'plan-land', 3],
  ['Pool edge', 'plan-wall', 'plan-water', 3],
  ['Window against wall and outline', 'plan-opening', 'plan-wall', 3],
  ['House outline and door against badge', 'cream', 'deep-teal', 3],
  ['House door accent against cream surround', 'orange', 'cream', 3],
]

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8')

it('keeps the CSS palette matched to the model without introducing other UI colors', () => {
  for (const [color, hex] of Object.entries(palette)) {
    expect(css).toContain(`--${color}: ${hex};`)
  }
  for (const hex of css.match(/#[\da-f]{3,8}\b/gi) ?? []) {
    expect(Object.values(palette), hex).toContain(hex.slice(0, 7).toUpperCase())
  }
  expect(css).not.toMatch(/gradient\(/)
})

for (const [name, theme] of Object.entries(themes)) {
  describe(name, () => {
    it('uses the modeled semantic roles in CSS', () => {
      const block = css.split(`.app[data-lighting="${name}"] {`)[1]?.split('}')[0]
      for (const [role, color] of Object.entries(theme)) {
        expect(block).toContain(`--${role}: var(--${color});`)
      }
    })

    const hex = (token: Role | Color) => palette[token in theme ? theme[token as Role] : token as Color]
    it.each(pairs)('%s passes contrast', (_use, foreground, background, minimum) => {
      const ratio = contrast(hex(foreground), hex(background))
      expect(ratio, `${hex(foreground)} on ${hex(background)}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(minimum)
    })
  })
}

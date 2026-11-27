export const palette = {
  'near-black': '#0A0F14',
  'deep-teal': '#0F3D3E',
  teal: '#2E6F73',
  'light-teal': '#7FB3B8',
  cream: '#EADCC8',
  orange: '#C6601F',
} as const

type Color = keyof typeof palette

export const themes = {
  day: {
    surface: 'cream', foreground: 'near-black', secondary: 'deep-teal',
    hover: 'light-teal', active: 'deep-teal', 'on-active': 'cream',
    'plan-land': 'light-teal', 'plan-room': 'cream', 'plan-water': 'light-teal',
    'plan-wall': 'near-black', 'plan-opening': 'teal',
  },
  night: {
    surface: 'near-black', foreground: 'cream', secondary: 'light-teal',
    hover: 'deep-teal', active: 'light-teal', 'on-active': 'near-black',
    'plan-land': 'deep-teal', 'plan-room': 'near-black', 'plan-water': 'teal',
    'plan-wall': 'cream', 'plan-opening': 'deep-teal',
  },
} as const satisfies Record<string, Record<string, Color>>

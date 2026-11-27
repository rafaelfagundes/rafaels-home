import { readFileSync, statSync } from 'node:fs'
import { expect, it } from 'vitest'
import { palette } from './palette'

const publicDir = new URL('../../public/', import.meta.url)

it('serves all icons and the web manifest referenced by index.html and the manifest', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
  const links = [...html.matchAll(/<link rel="(icon|apple-touch-icon|manifest)" href="\.\/([^"]+)"/g)]
    .map(([, , file]) => file)
  expect(links).toEqual(['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'manifest.webmanifest'])
  const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', publicDir), 'utf8')) as {
    theme_color: string
    background_color: string
    icons: { src: string; purpose: string }[]
  }
  expect(html).toContain(`name="theme-color" content="${palette.white}"`)
  expect(manifest.theme_color).toBe(palette.white)
  expect(manifest.background_color).toBe(palette.white)
  expect(manifest.icons.map(({ src, purpose }) => [src, purpose])).toEqual([
    ['favicon.svg', 'any'], ['icon-192.png', 'any'], ['icon-512.png', 'any'], ['icon-512-maskable.png', 'maskable'],
  ])
  for (const file of [...links, ...manifest.icons.map(icon => icon.src)]) {
    expect(statSync(new URL(file, publicDir)).size, file).toBeGreaterThan(0)
  }
})

it('ships matching brand glyphs and the required icon sizes', () => {
  const svg = readFileSync(new URL('favicon.svg', publicDir), 'utf8')
  expect(readFileSync(new URL('house.svg', publicDir), 'utf8')).toBe(svg)
  expect([...svg.matchAll(/#[0-9a-f]{6}/gi)].map(([color]) => color)).toEqual([
    palette['deep-teal'], palette.white, palette.white, palette.orange,
  ])

  const ico = readFileSync(new URL('favicon.ico', publicDir))
  expect(ico.readUInt16LE(2)).toBe(1)
  expect(ico.readUInt16LE(4)).toBe(3)
  for (const [index, size] of [16, 32, 48].entries()) {
    expect([ico[6 + 16 * index], ico[7 + 16 * index]]).toEqual([size, size])
  }

  const pngs = [
    ['apple-touch-icon.png', 180, 2], ['icon-192.png', 192, 6],
    ['icon-512.png', 512, 6], ['icon-512-maskable.png', 512, 2],
  ] as const
  for (const [file, size, colorType] of pngs) {
    const png = readFileSync(new URL(file, publicDir))
    expect([png.readUInt32BE(16), png.readUInt32BE(20), png[25]], file).toEqual([size, size, colorType])
  }
})

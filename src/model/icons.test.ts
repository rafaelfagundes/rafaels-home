import { readFileSync, statSync } from 'node:fs'
import { expect, it } from 'vitest'

const publicDir = new URL('../../public/', import.meta.url)

it('serves all icons and the web manifest referenced by index.html and the manifest', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
  const links = [...html.matchAll(/<link rel="(icon|apple-touch-icon|manifest)" href="\.\/([^"]+)"/g)]
    .map(([, , file]) => file)
  expect(links).toEqual(['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'manifest.webmanifest'])
  const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', publicDir), 'utf8')) as {
    icons: { src: string; purpose: string }[]
  }
  expect(manifest.icons.map(({ src, purpose }) => [src, purpose])).toEqual([
    ['favicon.svg', 'any'], ['icon-192.png', 'any'], ['icon-512.png', 'any'], ['icon-512-maskable.png', 'maskable'],
  ])
  for (const file of [...links, ...manifest.icons.map(icon => icon.src)]) {
    expect(statSync(new URL(file, publicDir)).size, file).toBeGreaterThan(0)
  }
})

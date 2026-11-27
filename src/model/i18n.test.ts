import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'vitest'
import { dictionary } from './i18n'

test('uses the localized app name in both languages', () => {
  expect(dictionary.en.appName).toBe('Rafael’s House')
  expect(dictionary['pt-BR'].appName).toBe('Casa do Rafael')
})

test.each(['index.html', 'public/manifest.webmanifest'])('uses the new app name in %s', (path) => {
  const contents = readFileSync(resolve(process.cwd(), path), 'utf8')
  expect(contents).toContain("Rafael's House")
  expect(contents).not.toMatch(/Rafael['’]s Home/i)
})

test('redirects the old Vercel host to the Open Graph URL host', () => {
  const config = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'))
  expect(config.redirects).toEqual([
    {
      source: '/:path*',
      has: [{ type: 'host', value: 'rafaels-home.vercel.app' }],
      destination: 'https://rafaels-house.vercel.app/:path*',
      permanent: true,
    },
  ])

  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
  expect(html).toContain('<meta property="og:url" content="https://rafaels-house.vercel.app/">')
})

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

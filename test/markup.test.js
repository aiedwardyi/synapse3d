import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

test('hand tracking button has an explicit button type', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')

  assert.match(html, /<button id="enable-tracking" type="button" hidden>/)
})

test('selection panel is present and hidden by default', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')

  assert.match(html, /<div id="selection-panel" hidden><\/div>/)
})

test('gesture HUD is exposed as a live status region', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8')

  assert.match(html, /<div id="gesture-hud" role="status" aria-live="polite" hidden><\/div>/)
})

test('gesture legend overlay intercepts background pointer events', async () => {
  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8')

  assert.match(css, /#gesture-legend\s*\{[^}]*pointer-events:\s*auto;/s)
})

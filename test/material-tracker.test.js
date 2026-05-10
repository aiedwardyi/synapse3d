import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMaterialTracker } from '../src/material-tracker.js'

test('track returns the material for inline construction', () => {
  const tracker = createMaterialTracker()
  const material = createMaterial()

  assert.equal(tracker.track(material), material)
})

test('disposeAll disposes tracked materials once and clears the tracker', () => {
  const tracker = createMaterialTracker()
  const first = createMaterial()
  const second = createMaterial()

  tracker.track(first)
  tracker.track(second)
  tracker.disposeAll()
  tracker.disposeAll()

  assert.equal(first.disposeCalls, 1)
  assert.equal(second.disposeCalls, 1)
})

function createMaterial() {
  return {
    disposeCalls: 0,
    dispose() {
      this.disposeCalls++
    }
  }
}

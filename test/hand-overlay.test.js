import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeLandmark } from '../src/hand-overlay.js'

test('normalizeLandmark mirrors x and scales to canvas dimensions', () => {
  assert.deepEqual(normalizeLandmark({ x: 0, y: 0 }, 320, 240), { x: 320, y: 0 })
  assert.deepEqual(normalizeLandmark({ x: 1, y: 1 }, 320, 240), { x: 0, y: 240 })
})

test('normalizeLandmark places a center landmark at the canvas midpoint', () => {
  assert.deepEqual(normalizeLandmark({ x: 0.5, y: 0.5 }, 320, 240), { x: 160, y: 120 })
})

test('normalizeLandmark scales x and y independently for non-square canvases', () => {
  const result = normalizeLandmark({ x: 0.25, y: 0.75 }, 800, 100)
  assert.equal(result.x, 600)
  assert.equal(result.y, 75)
})

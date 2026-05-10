import assert from 'node:assert/strict'
import { test } from 'node:test'
import { drawLandmarks, normalizeLandmark } from '../src/hand-overlay.js'

test('normalizeLandmark mirrors x and scales to canvas dimensions', () => {
  assert.deepEqual(normalizeLandmark({ x: 0, y: 0 }, 320, 240), { x: 319, y: 0 })
  assert.deepEqual(normalizeLandmark({ x: 1, y: 1 }, 320, 240), { x: 0, y: 239 })
})

test('normalizeLandmark places a center landmark at the canvas midpoint', () => {
  assert.deepEqual(normalizeLandmark({ x: 0.5, y: 0.5 }, 320, 240), { x: 160, y: 120 })
})

test('normalizeLandmark scales x and y independently for non-square canvases', () => {
  const result = normalizeLandmark({ x: 0.25, y: 0.75 }, 800, 100)
  assert.equal(result.x, 600)
  assert.equal(result.y, 75)
})

test('normalizeLandmark clamps out-of-range landmarks to drawable bounds', () => {
  assert.deepEqual(normalizeLandmark({ x: -0.5, y: -0.5 }, 320, 240), { x: 319, y: 0 })
  assert.deepEqual(normalizeLandmark({ x: 1.5, y: 1.5 }, 320, 240), { x: 0, y: 239 })
})

test('drawLandmarks returns when a 2d context is unavailable', () => {
  const canvas = {
    getContext: () => null,
    width: 320,
    height: 240
  }

  assert.doesNotThrow(() => drawLandmarks(canvas, [createHand()]))
})

test('drawLandmarks skips malformed hand landmark arrays', () => {
  const calls = []
  const canvas = {
    width: 320,
    height: 240,
    getContext: () => ({
      clearRect: () => calls.push('clearRect'),
      beginPath: () => calls.push('beginPath'),
      moveTo: () => calls.push('moveTo'),
      lineTo: () => calls.push('lineTo'),
      stroke: () => calls.push('stroke'),
      arc: () => calls.push('arc'),
      fill: () => calls.push('fill')
    })
  }
  const missingLandmarks = createHand().slice(0, 20)
  const nonNumericLandmarks = createHand()
  nonNumericLandmarks[0] = { x: 'bad', y: 0.5 }

  assert.doesNotThrow(() => {
    drawLandmarks(canvas, [null, missingLandmarks, nonNumericLandmarks, createHand()])
  })

  assert.equal(calls.filter(call => call === 'clearRect').length, 1)
  assert.equal(calls.filter(call => call === 'arc').length, 21)
})

test('drawLandmarks skips hands with non-finite coordinates', () => {
  const calls = []
  const canvas = {
    width: 320,
    height: 240,
    getContext: () => ({
      clearRect: () => calls.push('clearRect'),
      beginPath: () => calls.push('beginPath'),
      moveTo: () => calls.push('moveTo'),
      lineTo: () => calls.push('lineTo'),
      stroke: () => calls.push('stroke'),
      arc: () => calls.push('arc'),
      fill: () => calls.push('fill')
    })
  }
  const nanHand = createHand()
  nanHand[0] = { x: Number.NaN, y: 0.5 }
  const infiniteHand = createHand()
  infiniteHand[0] = { x: 0.5, y: Number.POSITIVE_INFINITY }

  assert.doesNotThrow(() => {
    drawLandmarks(canvas, [nanHand, infiniteHand, createHand()])
  })

  assert.equal(calls.filter(call => call === 'clearRect').length, 1)
  assert.equal(calls.filter(call => call === 'arc').length, 21)
})

function createHand() {
  return Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }))
}

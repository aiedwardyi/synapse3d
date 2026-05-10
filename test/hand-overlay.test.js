import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  drawFingertipCursor,
  drawLandmarks,
  normalizeLandmark
} from '../src/hand-overlay.js'

test('normalizeLandmark scales to canvas dimensions without mirroring', () => {
  assert.deepEqual(normalizeLandmark({ x: 0, y: 0 }, 320, 240), { x: 0, y: 0 })
  assert.deepEqual(normalizeLandmark({ x: 1, y: 1 }, 320, 240), { x: 319, y: 239 })
})

test('normalizeLandmark places a center landmark at the canvas midpoint', () => {
  assert.deepEqual(normalizeLandmark({ x: 0.5, y: 0.5 }, 320, 240), { x: 160, y: 120 })
})

test('normalizeLandmark scales x and y independently for non-square canvases', () => {
  const result = normalizeLandmark({ x: 0.25, y: 0.75 }, 800, 100)
  assert.equal(result.x, 200)
  assert.equal(result.y, 75)
})

test('normalizeLandmark clamps out-of-range landmarks to drawable bounds', () => {
  assert.deepEqual(normalizeLandmark({ x: -0.5, y: -0.5 }, 320, 240), { x: 0, y: 0 })
  assert.deepEqual(normalizeLandmark({ x: 1.5, y: 1.5 }, 320, 240), { x: 319, y: 239 })
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

test('drawLandmarks skips sparse hand landmark arrays', () => {
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
  const sparseHand = new Array(21)
  sparseHand[0] = { x: 0.5, y: 0.5 }

  assert.doesNotThrow(() => {
    drawLandmarks(canvas, [sparseHand, createHand()])
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

test('drawLandmarks renders a hand at fullscreen 1920x1080 dimensions', () => {
  const calls = []
  const clearRectArgs = []
  const canvas = {
    width: 1920,
    height: 1080,
    getContext: () => ({
      clearRect: (x, y, w, h) => {
        calls.push('clearRect')
        clearRectArgs.push([x, y, w, h])
      },
      beginPath: () => calls.push('beginPath'),
      moveTo: () => calls.push('moveTo'),
      lineTo: () => calls.push('lineTo'),
      stroke: () => calls.push('stroke'),
      arc: () => calls.push('arc'),
      fill: () => calls.push('fill')
    })
  }

  assert.doesNotThrow(() => drawLandmarks(canvas, [createHand()]))

  assert.equal(calls.filter(call => call === 'clearRect').length, 1)
  assert.deepEqual(clearRectArgs[0], [0, 0, 1920, 1080])
  assert.equal(calls.filter(call => call === 'arc').length, 21)
  assert.ok(calls.includes('stroke'))
})

test('drawFingertipCursor draws a stroked circle at the normalized point', () => {
  const calls = []
  const canvas = {
    width: 200,
    height: 100,
    getContext: () => ({
      set strokeStyle(value) {
        calls.push(['strokeStyle', value])
      },
      set lineWidth(value) {
        calls.push(['lineWidth', value])
      },
      beginPath: () => calls.push(['beginPath']),
      arc: (...args) => calls.push(['arc', ...args]),
      stroke: () => calls.push(['stroke'])
    })
  }

  drawFingertipCursor(canvas, { x: 0.25, y: 0.75 }, true)

  const arcCall = calls.find(call => call[0] === 'arc')
  assert.deepEqual(calls[0], ['strokeStyle', '#e2a04a'])
  assert.deepEqual(calls[1], ['lineWidth', 3])
  assert.deepEqual(calls[2], ['beginPath'])
  assert.equal(arcCall[1], 50)
  assert.equal(arcCall[2], 75)
  assert.equal(arcCall[3], 14)
  assert.equal(arcCall[4], 0)
  assert.equal(arcCall[5], Math.PI * 2)
  assert.deepEqual(calls[calls.length - 1], ['stroke'])
})

function createHand() {
  return Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }))
}

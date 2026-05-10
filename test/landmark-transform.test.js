import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyCoverTransform, mirrorLandmarkX } from '../src/landmark-transform.js'

test('applyCoverTransform maps source center to container center across aspect ratios', () => {
  const cases = [
    [640, 480, 640, 480],
    [640, 480, 1920, 1080],
    [640, 480, 600, 900]
  ]

  for (const [sourceW, sourceH, containerW, containerH] of cases) {
    const result = applyCoverTransform(
      { x: 0.5, y: 0.5 },
      sourceW,
      sourceH,
      containerW,
      containerH
    )

    assertApprox(result.x, 0.5)
    assertApprox(result.y, 0.5)
  }
})

test('applyCoverTransform maps cropped top source coordinates above wide containers', () => {
  const result = applyCoverTransform({ x: 0.5, y: 0 }, 640, 480, 1920, 1080)

  assert.ok(result.y < 0)
})

test('applyCoverTransform maps cropped left source coordinates outside tall containers', () => {
  const result = applyCoverTransform({ x: 0, y: 0.5 }, 640, 480, 600, 900)

  assert.ok(result.x < 0)
})

test('mirrorLandmarkX mirrors the x coordinate and keeps y unchanged', () => {
  assert.deepEqual(mirrorLandmarkX({ x: 0.3, y: 0.7 }), { x: 0.7, y: 0.7 })
})

function assertApprox(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-12, `expected ${actual} to be close to ${expected}`)
}

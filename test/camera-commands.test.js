import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  computeOrbitedPosition,
  computeZoomedPosition
} from '../src/camera-commands.js'

function approx(actual, expected, epsilon = 1e-6) {
  return Math.abs(actual - expected) < epsilon
}

test('computeZoomedPosition moves camera closer along the same axis when zooming in', () => {
  const pos = { x: 0, y: 0, z: 100 }
  const target = { x: 0, y: 0, z: 0 }
  const next = computeZoomedPosition(pos, target, 'in', { factor: 0.8 })

  assert.ok(approx(next.x, 0))
  assert.ok(approx(next.y, 0))
  assert.ok(approx(next.z, 80))
})

test('computeZoomedPosition moves camera further along the same axis when zooming out', () => {
  const pos = { x: 0, y: 0, z: 100 }
  const target = { x: 0, y: 0, z: 0 }
  const next = computeZoomedPosition(pos, target, 'out', { factor: 0.8 })

  assert.ok(approx(next.x, 0))
  assert.ok(approx(next.y, 0))
  assert.ok(approx(next.z, 125))
})

test('computeZoomedPosition clamps to the configured min radius', () => {
  const pos = { x: 0, y: 0, z: 11 }
  const target = { x: 0, y: 0, z: 0 }
  const next = computeZoomedPosition(pos, target, 'in', {
    factor: 0.5,
    minRadius: 9,
    maxRadius: 100
  })

  assert.ok(approx(next.z, 9))
})

test('computeZoomedPosition clamps to the configured max radius', () => {
  const pos = { x: 0, y: 0, z: 100 }
  const target = { x: 0, y: 0, z: 0 }
  const next = computeZoomedPosition(pos, target, 'out', {
    factor: 0.5,
    minRadius: 1,
    maxRadius: 150
  })

  assert.ok(approx(next.z, 150))
})

test('computeZoomedPosition leaves position unchanged when on the target', () => {
  const pos = { x: 5, y: 5, z: 5 }
  const target = { x: 5, y: 5, z: 5 }
  const next = computeZoomedPosition(pos, target, 'in')

  assert.deepEqual(next, { x: 5, y: 5, z: 5 })
})

test('computeZoomedPosition leaves position unchanged for unknown direction', () => {
  const pos = { x: 0, y: 0, z: 100 }
  const target = { x: 0, y: 0, z: 0 }
  const next = computeZoomedPosition(pos, target, 'sideways', { factor: 0.8 })

  assert.deepEqual(next, pos)
})

test('computeZoomedPosition scales radius by the requested factor when within bounds', () => {
  const pos = { x: 30, y: 40, z: 120 }
  const target = { x: 0, y: 0, z: 0 }
  const initialRadius = Math.hypot(pos.x, pos.y, pos.z)
  const next = computeZoomedPosition(pos, target, 'in', { factor: 0.5 })
  const newRadius = Math.hypot(next.x, next.y, next.z)

  assert.ok(approx(newRadius, initialRadius * 0.5))
})

test('computeOrbitedPosition rotates left by decreasing theta', () => {
  const pos = { x: 0, y: 0, z: 10 }
  const target = { x: 0, y: 0, z: 0 }
  const next = computeOrbitedPosition(pos, target, 'left', { step: Math.PI / 12 })

  assert.ok(next.x < 0, 'rotating left should move camera toward -X from +Z')
  assert.ok(approx(next.y, 0))
  assert.ok(approx(Math.hypot(next.x, next.y, next.z), 10))
})

test('computeOrbitedPosition rotates right by increasing theta', () => {
  const pos = { x: 0, y: 0, z: 10 }
  const target = { x: 0, y: 0, z: 0 }
  const next = computeOrbitedPosition(pos, target, 'right', { step: Math.PI / 12 })

  assert.ok(next.x > 0, 'rotating right should move camera toward +X from +Z')
  assert.ok(approx(next.y, 0))
  assert.ok(approx(Math.hypot(next.x, next.y, next.z), 10))
})

test('computeOrbitedPosition rotates up by raising Y', () => {
  const pos = { x: 0, y: 0, z: 10 }
  const target = { x: 0, y: 0, z: 0 }
  const next = computeOrbitedPosition(pos, target, 'up', { step: Math.PI / 12 })

  assert.ok(next.y > 0)
  assert.ok(approx(Math.hypot(next.x, next.y, next.z), 10))
})

test('computeOrbitedPosition rotates down by lowering Y', () => {
  const pos = { x: 0, y: 0, z: 10 }
  const target = { x: 0, y: 0, z: 0 }
  const next = computeOrbitedPosition(pos, target, 'down', { step: Math.PI / 12 })

  assert.ok(next.y < 0)
  assert.ok(approx(Math.hypot(next.x, next.y, next.z), 10))
})

test('computeOrbitedPosition clamps phi so the camera does not flip through the pole', () => {
  const pos = { x: 0, y: 0, z: 10 }
  const target = { x: 0, y: 0, z: 0 }
  let next = pos
  // Step up many times; phi should clamp before crossing 0.
  for (let i = 0; i < 100; i++) {
    next = computeOrbitedPosition(next, target, 'up', { step: Math.PI / 6 })
  }
  // Camera stays on the +Y side of the pole; never flips to -Y.
  assert.ok(next.y > 0)
  assert.ok(next.y < 10)
  assert.ok(approx(Math.hypot(next.x, next.y, next.z), 10))
})

test('computeOrbitedPosition leaves position unchanged when on the target', () => {
  const pos = { x: 2, y: 2, z: 2 }
  const target = { x: 2, y: 2, z: 2 }
  const next = computeOrbitedPosition(pos, target, 'left')

  assert.deepEqual(next, { x: 2, y: 2, z: 2 })
})

test('computeOrbitedPosition preserves radius around an offset target', () => {
  const pos = { x: 5, y: 5, z: 15 }
  const target = { x: 5, y: 5, z: 5 }
  const initialRadius = 10
  const next = computeOrbitedPosition(pos, target, 'left', { step: Math.PI / 4 })
  const dx = next.x - target.x
  const dy = next.y - target.y
  const dz = next.z - target.z

  assert.ok(approx(Math.hypot(dx, dy, dz), initialRadius))
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { createStarfield } from '../src/starfield.js'

const DEFAULT_STAR_COUNT = 240
const DEFAULT_RADIUS = 1200
const RADIUS_EPSILON = 1e-6

test('createStarfield uses defaults when called without arguments', () => {
  const starfield = createStarfield()
  const position = starfield.geometry.getAttribute('position')

  assert.equal(position.count, DEFAULT_STAR_COUNT)
  assert.equal(starfield.material.opacity, 0.28)
  assert.equal(typeof starfield.userData.dispose, 'function')
})

test('createStarfield returns points with the requested star count', () => {
  const starfield = createStarfield({
    count: 12,
    radius: 50,
    opacity: 0.25
  })
  const position = starfield.geometry.getAttribute('position')

  assert.ok(starfield instanceof THREE.Points)
  assert.ok(starfield.geometry instanceof THREE.BufferGeometry)
  assert.equal(position.count, 12)
  assert.equal(position.itemSize, 3)
  assert.equal(position.array.length, 36)
  assert.equal(starfield.material.transparent, true)
  assert.equal(starfield.material.opacity, 0.25)
  assert.equal(starfield.material.depthWrite, false)
  assert.equal(typeof starfield.userData.dispose, 'function')
})

test('createStarfield places every star inside the configured radius', () => {
  const radius = 75
  const starfield = createStarfield({
    count: 20,
    radius
  })
  const position = starfield.geometry.getAttribute('position')

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)

    assert.ok(Number.isFinite(x))
    assert.ok(Number.isFinite(y))
    assert.ok(Number.isFinite(z))
    assert.ok(Math.hypot(x, y, z) <= radius + RADIUS_EPSILON)
  }
})

test('createStarfield keeps stars in the outer shell', () => {
  withStubbedRandom([0, 0.5, 0], () => {
    const radius = 100
    const starfield = createStarfield({
      count: 1,
      radius
    })
    const position = starfield.geometry.getAttribute('position')
    const distance = Math.hypot(position.getX(0), position.getY(0), position.getZ(0))

    assert.ok(distance >= radius * 0.82 - RADIUS_EPSILON)
    assert.ok(distance <= radius + RADIUS_EPSILON)
  })
})

test('createStarfield falls back to the default radius for invalid radius input', () => {
  for (const radius of [Number.NaN, Number.POSITIVE_INFINITY, -25, 0]) {
    const starfield = createStarfield({
      count: 3,
      radius
    })
    const position = starfield.geometry.getAttribute('position')

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i)
      const y = position.getY(i)
      const z = position.getZ(i)

      assert.ok(Number.isFinite(x))
      assert.ok(Number.isFinite(y))
      assert.ok(Number.isFinite(z))
      assert.ok(Math.hypot(x, y, z) >= DEFAULT_RADIUS * 0.82 - RADIUS_EPSILON)
      assert.ok(Math.hypot(x, y, z) <= DEFAULT_RADIUS + RADIUS_EPSILON)
    }
  }
})

test('createStarfield handles zero, negative, non-finite, and fractional counts', () => {
  for (const count of [0, -1, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
    const starfield = createStarfield({ count })

    assert.equal(starfield.geometry.getAttribute('position').count, 0)
  }

  const starfield = createStarfield({ count: 3.9 })

  assert.equal(starfield.geometry.getAttribute('position').count, 3)
})

function withStubbedRandom(values, runTest) {
  const originalRandom = Math.random
  let index = 0

  Math.random = () => values[index++ % values.length]
  try {
    runTest()
  } finally {
    Math.random = originalRandom
  }
}

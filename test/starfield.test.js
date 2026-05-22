import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { createStarfield } from '../src/starfield.js'

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
    assert.ok(Math.hypot(x, y, z) <= radius)
  }
})

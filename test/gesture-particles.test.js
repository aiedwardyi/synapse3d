import assert from 'node:assert/strict'
import { test } from 'node:test'
import { linkDirectionalParticlesForGestureState } from '../src/gesture-particles.js'

test('linkDirectionalParticlesForGestureState keeps idle particles at the baseline count', () => {
  assert.equal(linkDirectionalParticlesForGestureState('idle', 1), 1)
  assert.equal(linkDirectionalParticlesForGestureState('idle', 2), 2)
})

test('linkDirectionalParticlesForGestureState disables particles for active gesture states', () => {
  for (const state of ['select', 'drag', 'orbit', 'zoom']) {
    assert.equal(linkDirectionalParticlesForGestureState(state, 1), 0)
  }
})

test('linkDirectionalParticlesForGestureState treats unknown states as idle', () => {
  assert.equal(linkDirectionalParticlesForGestureState('unknown', 1), 1)
  assert.equal(linkDirectionalParticlesForGestureState(undefined, 1), 1)
})

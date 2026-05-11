import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPinchSelectionAttempt } from '../src/pinch-selection-attempt.js'

test('shouldAttempt returns false while pinch is inactive', () => {
  const selectionAttempt = createPinchSelectionAttempt()

  assert.equal(selectionAttempt.shouldAttempt(false), false)
})

test('shouldAttempt keeps returning true while pinch is held before a hit', () => {
  const selectionAttempt = createPinchSelectionAttempt()

  assert.equal(selectionAttempt.shouldAttempt(true), true)
  assert.equal(selectionAttempt.shouldAttempt(true), true)
})

test('recordHit stops further attempts until reset', () => {
  const selectionAttempt = createPinchSelectionAttempt()

  assert.equal(selectionAttempt.shouldAttempt(true), true)
  selectionAttempt.recordHit()

  assert.equal(selectionAttempt.shouldAttempt(true), false)
  selectionAttempt.reset()
  assert.equal(selectionAttempt.shouldAttempt(true), true)
})

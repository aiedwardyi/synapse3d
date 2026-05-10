import assert from 'node:assert/strict'
import { test } from 'node:test'
import { updateTrackingButtonAfterRender } from '../src/hand-tracking-ui.js'

test('shows and enables the tracking button before tracking starts', () => {
  const button = { hidden: true, disabled: true }

  updateTrackingButtonAfterRender(button, false)

  assert.equal(button.hidden, false)
  assert.equal(button.disabled, false)
})

test('keeps the tracking button hidden after tracking has started', () => {
  const button = { hidden: true, disabled: true }

  updateTrackingButtonAfterRender(button, true)

  assert.equal(button.hidden, true)
  assert.equal(button.disabled, true)
})

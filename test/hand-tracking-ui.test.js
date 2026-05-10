import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  resetTrackingUiAfterError,
  updateTrackingButtonAfterRender
} from '../src/hand-tracking-ui.js'

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

test('resets camera and controls after a runtime tracking error', () => {
  const stopped = []
  const button = { hidden: true, disabled: true }
  const video = { hidden: false }
  const canvas = { hidden: false }

  resetTrackingUiAfterError({
    button,
    video,
    canvas,
    stopVideoStream: target => stopped.push(target)
  })

  assert.deepEqual(stopped, [video])
  assert.equal(button.hidden, false)
  assert.equal(button.disabled, false)
  assert.equal(video.hidden, true)
  assert.equal(canvas.hidden, true)
})

import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { createVoiceListener, shouldRecycleNow, recycleDelayMs } from '../src/voice.js'

const originalWindow = globalThis.window

afterEach(() => {
  globalThis.window = originalWindow
})

function startFakeListener() {
  const instances = []
  class FakeRecognition {
    constructor() {
      instances.push(this)
    }

    start() {}
    stop() {}
  }

  globalThis.window = { webkitSpeechRecognition: FakeRecognition }

  const states = []
  const errors = []
  const listener = createVoiceListener({
    onStateChange: state => states.push(state),
    onError: err => errors.push(err)
  })

  listener.start()

  return { instances, states, errors, listener }
}

test('createVoiceListener reports permanent recognition errors as visible error state', () => {
  const { instances, states, errors, listener } = startFakeListener()

  instances[0].onerror({ error: 'not-allowed' })

  assert.equal(listener.isListening(), false)
  assert.equal(errors[0].message, 'not-allowed')
  assert.deepEqual(states.at(-1), { state: 'error', text: 'not-allowed' })
})

test('createVoiceListener reports service-not-allowed as visible error state', () => {
  const { instances, states, errors, listener } = startFakeListener()

  instances[0].onerror({ error: 'service-not-allowed' })

  assert.equal(listener.isListening(), false)
  assert.equal(errors[0].message, 'service-not-allowed')
  assert.deepEqual(states.at(-1), { state: 'error', text: 'service-not-allowed' })
})

test('createVoiceListener reports restart-loop errors as visible error state', () => {
  const { instances, states, errors, listener } = startFakeListener()

  for (let i = 0; i < 4; i++) {
    instances[0].onerror({ error: 'network' })
  }

  assert.equal(listener.isListening(), false)
  assert.equal(errors.at(-1).message, 'restart-loop:network')
  assert.deepEqual(states.at(-1), { state: 'error', text: 'restart-loop:network' })
})

test('shouldRecycleNow recycles after the inactivity threshold with no activity', () => {
  assert.equal(
    shouldRecycleNow({ status: 'listening', lastActivityAt: 0, now: 10000, thresholdMs: 9000 }),
    true
  )
})

test('shouldRecycleNow does not recycle when activity is recent', () => {
  assert.equal(
    shouldRecycleNow({ status: 'listening', lastActivityAt: 8000, now: 10000, thresholdMs: 9000 }),
    false
  )
})

test('shouldRecycleNow does not recycle while reconnecting', () => {
  assert.equal(
    shouldRecycleNow({ status: 'reconnecting', lastActivityAt: 0, now: 10000, thresholdMs: 9000 }),
    false
  )
})

test('recycleDelayMs backs off once recycles churn within the window', () => {
  const opts = { maxRecycles: 4, baseDelayMs: 350, backoffDelayMs: 1200 }
  assert.equal(recycleDelayMs({ ...opts, recentRecycleCount: 1 }), 350)
  assert.equal(recycleDelayMs({ ...opts, recentRecycleCount: 4 }), 1200)
})

test('a recycle preserves awaiting-answer mode', () => {
  const { instances, listener } = startFakeListener()

  listener.armAwaitingAnswer()
  assert.equal(listener.isAwaitingAnswer(), true)

  instances[0].onend()

  assert.equal(listener.isAwaitingAnswer(), true)
  assert.equal(listener.isListening(), true)

  listener.stop()
})

test('a recycle surfaces a reconnecting state before relisting', () => {
  const { instances, states, listener } = startFakeListener()

  instances[0].onend()

  assert.deepEqual(states.at(-1), { state: 'reconnecting' })

  listener.stop()
})

import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { createVoiceListener } from '../src/voice.js'

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

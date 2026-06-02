import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { createVoiceListener } from '../src/voice.js'

const originalWindow = globalThis.window

afterEach(() => {
  globalThis.window = originalWindow
})

test('createVoiceListener reports permanent recognition errors as visible error state', () => {
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
  instances[0].onerror({ error: 'not-allowed' })

  assert.equal(listener.isListening(), false)
  assert.equal(errors[0].message, 'not-allowed')
  assert.deepEqual(states.at(-1), { state: 'error', text: 'not-allowed' })
})

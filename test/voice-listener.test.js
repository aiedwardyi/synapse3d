import assert from 'node:assert/strict'
import { afterEach, test, mock } from 'node:test'
import { createVoiceListener, shouldRecycleNow, recycleDelayMs } from '../src/voice.js'

const originalWindow = globalThis.window
const originalPerformanceNow = globalThis.performance.now

afterEach(() => {
  globalThis.window = originalWindow
  globalThis.performance.now = originalPerformanceNow
  mock.timers.reset()
})

function startFakeListener() {
  const instances = []
  class FakeRecognition {
    constructor() {
      this.started = false
      this.stopped = false
      instances.push(this)
    }

    start() {
      this.started = true
    }

    stop() {
      this.stopped = true
    }
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

// Drive both the recycle debounce and the watchdog deterministically. nowMs()
// reads performance.now(), which the node:test timer mock does not touch, so the
// clock is mocked separately from setTimeout.
function useFakeClock() {
  mock.timers.enable({ apis: ['setTimeout'] })
  const clock = { now: 0 }
  globalThis.performance.now = () => clock.now
  return clock
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

test('shouldRecycleNow backs off once recent recycles reach the cap', () => {
  assert.equal(
    shouldRecycleNow({
      status: 'listening',
      lastActivityAt: 0,
      now: 10000,
      thresholdMs: 9000,
      recentRecycleCount: 4,
      maxRecycles: 4
    }),
    false
  )
})

test('shouldRecycleNow ignores non-finite clock inputs', () => {
  assert.equal(
    shouldRecycleNow({ status: 'listening', lastActivityAt: NaN, now: 10000, thresholdMs: 9000 }),
    false
  )
  assert.equal(
    shouldRecycleNow({ status: 'listening', lastActivityAt: 0, now: Infinity, thresholdMs: 9000 }),
    false
  )
  assert.equal(
    shouldRecycleNow({ status: 'listening', lastActivityAt: 0, now: 10000, thresholdMs: NaN }),
    false
  )
})

test('recycleDelayMs backs off once recycles churn within the window', () => {
  const opts = { maxRecycles: 4, baseDelayMs: 350, backoffDelayMs: 1200 }
  assert.equal(recycleDelayMs({ ...opts, recentRecycleCount: 1 }), 350)
  assert.equal(recycleDelayMs({ ...opts, recentRecycleCount: 4 }), 1200)
})

test('the watchdog keeps polling and recycles once activity goes stale', () => {
  const clock = useFakeClock()
  const { instances, listener } = startFakeListener()
  assert.equal(instances.length, 1)

  // First poll with a fresh clock: no recycle, but the poll reschedules itself.
  mock.timers.tick(2000)
  assert.equal(instances.length, 1)

  // The clock goes stale past the threshold; a later poll must fire (proving the
  // reschedule) and recycle the wedged recognizer.
  clock.now = 20000
  mock.timers.tick(2000)
  mock.timers.tick(350)

  assert.equal(instances.length, 2)
  assert.equal(instances[1].started, true)
  assert.equal(instances[0].stopped, true)
  assert.equal(listener.isListening(), true)

  listener.stop()
})

test('stop clears the watchdog timer so polling stops', () => {
  const clock = useFakeClock()
  const { instances, states, listener } = startFakeListener()

  listener.stop()
  const instanceCount = instances.length
  const stateCount = states.length

  // A long-stale clock plus many ticks must not revive a recycle once stopped.
  clock.now = 100000
  mock.timers.tick(2000)
  mock.timers.tick(2000)
  mock.timers.tick(2000)

  assert.equal(instances.length, instanceCount)
  assert.equal(states.length, stateCount)
  assert.equal(listener.isListening(), false)
})

test('a recycle surfaces reconnecting then rebuilds and relists', () => {
  useFakeClock()
  const { instances, states, listener } = startFakeListener()

  instances[0].onend()
  assert.deepEqual(states.at(-1), { state: 'reconnecting' })

  mock.timers.tick(350)

  assert.equal(instances.length, 2)
  assert.equal(instances[1].started, true)
  assert.equal(instances[0].stopped, true)
  assert.deepEqual(states.at(-1), { state: 'listening' })

  listener.stop()
})

test('a recycle during awaiting-answer is silent and preserves the mode', () => {
  useFakeClock()
  const { instances, states, listener } = startFakeListener()

  listener.armAwaitingAnswer()
  assert.equal(listener.isAwaitingAnswer(), true)
  const before = states.length

  instances[0].onend()
  mock.timers.tick(350)

  // The recycle still rebuilds a fresh, started recognizer.
  assert.equal(instances.length, 2)
  assert.equal(instances[1].started, true)
  assert.equal(instances[0].stopped, true)
  // The clarify mode survives and nothing is painted over the asking prompt.
  assert.equal(listener.isAwaitingAnswer(), true)
  const emitted = states.slice(before).map(state => state.state)
  assert.equal(emitted.includes('reconnecting'), false)
  assert.equal(emitted.includes('listening'), false)

  listener.stop()
})

test('a pending recycle is canceled when activity resumes during the debounce', () => {
  const clock = useFakeClock()
  const { instances, states, listener } = startFakeListener()

  // Drive the watchdog to schedule a recycle.
  clock.now = 20000
  mock.timers.tick(2000)
  assert.equal(instances.length, 1)
  assert.deepEqual(states.at(-1), { state: 'reconnecting' })

  // Activity resumes before the debounce elapses, so the recycle is canceled.
  instances[0].onspeechstart()
  assert.deepEqual(states.at(-1), { state: 'listening' })

  mock.timers.tick(350)

  assert.equal(instances.length, 1)
  assert.equal(instances[0].stopped, false)
  assert.equal(listener.isListening(), true)

  listener.stop()
})

test('a thrown start surfaces reconnecting and retries on a backoff', () => {
  useFakeClock()
  const instances = []
  class ThrowOnceRecognition {
    constructor() {
      this.started = false
      instances.push(this)
    }

    start() {
      // The first instance mimics Chrome throwing InvalidStateError on start.
      if (instances.length === 1) throw new Error('InvalidStateError')
      this.started = true
    }

    stop() {}
  }

  globalThis.window = { webkitSpeechRecognition: ThrowOnceRecognition }
  const states = []
  const listener = createVoiceListener({ onStateChange: state => states.push(state) })

  listener.start()
  assert.deepEqual(states.at(-1), { state: 'reconnecting' })

  mock.timers.tick(1200)

  assert.equal(instances.length, 2)
  assert.equal(instances[1].started, true)
  assert.deepEqual(states.at(-1), { state: 'listening' })

  listener.stop()
})

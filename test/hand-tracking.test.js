import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  WASM_BASE_URL,
  createHandTracker,
  stopVideoStream
} from '../src/hand-tracking.js'

function withAnimationFrame(testBody) {
  const originalRaf = globalThis.requestAnimationFrame
  const originalCancel = globalThis.cancelAnimationFrame
  const callbacks = []

  globalThis.requestAnimationFrame = callback => {
    callbacks.push(callback)
    return callbacks.length
  }
  globalThis.cancelAnimationFrame = () => {}

  return Promise.resolve()
    .then(() => testBody(callbacks))
    .finally(() => {
      globalThis.requestAnimationFrame = originalRaf
      globalThis.cancelAnimationFrame = originalCancel
    })
}

test('pins MediaPipe WASM URL to the installed package version', () => {
  assert.equal(
    WASM_BASE_URL,
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
  )
})

test('falls back to CPU when GPU hand landmarker creation fails', async () => {
  const delegates = []
  const fakeLandmarker = {
    detectForVideo: () => ({ landmarks: [] }),
    close: () => {}
  }
  const handLandmarker = {
    async createFromOptions(_vision, options) {
      delegates.push(options.baseOptions.delegate)
      if (options.baseOptions.delegate === 'GPU') {
        throw new Error('gpu unavailable')
      }
      return fakeLandmarker
    }
  }

  const tracker = await createHandTracker({
    video: { readyState: 0, currentTime: 0 },
    modelAssetUrl: '/hand.task',
    filesetResolver: { forVisionTasks: async () => ({}) },
    handLandmarker
  })

  assert.deepEqual(delegates, ['GPU', 'CPU'])
  tracker.stop()
})

test('runs inference only once per video frame', async () => {
  await withAnimationFrame(async callbacks => {
    const detections = []
    const video = { readyState: 2, currentTime: 1 }
    const tracker = await createHandTracker({
      video,
      modelAssetUrl: '/hand.task',
      filesetResolver: { forVisionTasks: async () => ({}) },
      handLandmarker: {
        async createFromOptions() {
          return {
            detectForVideo() {
              detections.push(video.currentTime)
              return { landmarks: [] }
            },
            close: () => {}
          }
        }
      }
    })

    tracker.start(() => {})
    callbacks.shift()()
    video.currentTime = 1.1
    callbacks.shift()()
    tracker.stop()

    assert.deepEqual(detections, [1, 1.1])
  })
})

test('starts detection on the next animation frame', async () => {
  await withAnimationFrame(async callbacks => {
    let detections = 0
    const tracker = await createHandTracker({
      video: { readyState: 2, currentTime: 1 },
      modelAssetUrl: '/hand.task',
      filesetResolver: { forVisionTasks: async () => ({}) },
      handLandmarker: {
        async createFromOptions() {
          return {
            detectForVideo: () => ({ landmarks: [] }),
            close: () => {}
          }
        }
      }
    })

    tracker.start(() => {
      detections++
    })

    assert.equal(detections, 0)
    assert.equal(callbacks.length, 1)

    callbacks.shift()()
    tracker.stop()

    assert.equal(detections, 1)
  })
})

test('stops all tracks and clears the video stream after startup failure', () => {
  const stopped = []
  const video = {
    srcObject: {
      getTracks: () => [
        { stop: () => stopped.push('video') },
        { stop: () => stopped.push('audio') }
      ]
    }
  }

  stopVideoStream(video)

  assert.deepEqual(stopped, ['video', 'audio'])
  assert.equal(video.srcObject, null)
})

test('rejects restart after stop closes the hand landmarker', async () => {
  await withAnimationFrame(async () => {
    const tracker = await createHandTracker({
      video: { readyState: 0, currentTime: 0 },
      modelAssetUrl: '/hand.task',
      filesetResolver: { forVisionTasks: async () => ({}) },
      handLandmarker: {
        async createFromOptions() {
          return {
            detectForVideo: () => ({ landmarks: [] }),
            close: () => {}
          }
        }
      }
    })

    tracker.stop()

    assert.throws(
      () => tracker.start(() => {}),
      /closed/
    )
  })
})

test('stops tracking and reports detection errors from the RAF loop', async t => {
  await withAnimationFrame(async callbacks => {
    const error = new Error('detect failed')
    const reported = []
    const warnings = []
    let closeCount = 0
    t.mock.method(console, 'warn', (...args) => warnings.push(args))
    const tracker = await createHandTracker({
      video: { readyState: 2, currentTime: 1 },
      modelAssetUrl: '/hand.task',
      filesetResolver: { forVisionTasks: async () => ({}) },
      handLandmarker: {
        async createFromOptions() {
          return {
            detectForVideo: () => {
              throw error
            },
            close: () => {
              closeCount++
            }
          }
        }
      }
    })

    tracker.start(() => {}, err => reported.push(err))
    assert.deepEqual(reported, [])
    callbacks.shift()()

    assert.deepEqual(reported, [error])
    assert.equal(warnings.length, 1)
    assert.equal(closeCount, 1)
    assert.equal(callbacks.length, 0)
    assert.throws(
      () => tracker.start(() => {}),
      /closed/
    )
  })
})

test('stops tracking and reports when video frames stop advancing', async t => {
  await withAnimationFrame(async callbacks => {
    const reported = []
    const warnings = []
    let closeCount = 0
    const video = { readyState: 2, currentTime: 1 }
    t.mock.method(console, 'warn', (...args) => warnings.push(args))
    const tracker = await createHandTracker({
      video,
      modelAssetUrl: '/hand.task',
      maxStaleVideoFrames: 2,
      filesetResolver: { forVisionTasks: async () => ({}) },
      handLandmarker: {
        async createFromOptions() {
          return {
            detectForVideo: () => ({ landmarks: [] }),
            close: () => {
              closeCount++
            }
          }
        }
      }
    })

    tracker.start(() => {}, err => reported.push(err))
    callbacks.shift()()
    callbacks.shift()()
    callbacks.shift()()

    assert.equal(reported.length, 1)
    assert.match(reported[0].message, /stopped producing frames/)
    assert.equal(warnings.length, 1)
    assert.equal(closeCount, 1)
    assert.equal(callbacks.length, 0)
    assert.throws(
      () => tracker.start(() => {}),
      /closed/
    )
  })
})

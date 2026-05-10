import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

export const MEDIAPIPE_TASKS_VERSION = '0.10.35'
export const WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_TASKS_VERSION}/wasm`
const HAVE_CURRENT_DATA = 2
const TRACKER_DELEGATES = ['GPU', 'CPU']

// Prompts for camera access. MUST be called from a user gesture.
export async function requestCameraStream(constraints = { video: { width: 640, height: 480 } }) {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Your browser does not support camera access.')
  }
  return navigator.mediaDevices.getUserMedia(constraints)
}

export function stopVideoStream(video) {
  if (!video?.srcObject) return

  const stream = video.srcObject
  if (typeof stream.getTracks === 'function') {
    for (const track of stream.getTracks()) {
      track.stop()
    }
  }
  video.srcObject = null
}

// Loads MediaPipe and returns a tracker controller.
export async function createHandTracker({
  video,
  modelAssetUrl,
  numHands = 2,
  filesetResolver = FilesetResolver,
  handLandmarker = HandLandmarker
}) {
  const vision = await filesetResolver.forVisionTasks(WASM_BASE_URL)
  const landmarker = await createLandmarker({
    handLandmarker,
    vision,
    modelAssetUrl,
    numHands
  })

  let rafId = null
  let running = false
  let closed = false
  let lastTimestamp = 0
  let lastVideoTime = null

  function tick(onLandmarks, onError) {
    if (!running) return

    if (video.readyState >= HAVE_CURRENT_DATA && hasNewVideoFrame()) {
      // detectForVideo requires strictly increasing timestamps in milliseconds.
      const now = performance.now()
      const timestamp = now > lastTimestamp ? now : lastTimestamp + 1
      lastTimestamp = timestamp
      try {
        const result = landmarker.detectForVideo(video, timestamp)
        onLandmarks(result)
      } catch (err) {
        console.warn('Hand tracking stopped after detection error:', err)
        closeTracker()
        onError?.(err)
        return
      }
    }

    rafId = requestAnimationFrame(() => tick(onLandmarks, onError))
  }

  return {
    start(onLandmarks, onError) {
      if (closed) {
        throw new Error('Hand tracker is closed. Create a new tracker instance before restarting.')
      }
      if (running) return
      running = true
      tick(onLandmarks, onError)
    },
    stop() {
      closeTracker()
    }
  }

  function closeTracker() {
    if (closed) return

    running = false
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
    landmarker.close?.()
    closed = true
  }

  function hasNewVideoFrame() {
    if (typeof video.currentTime !== 'number') return true
    if (video.currentTime === lastVideoTime) return false

    lastVideoTime = video.currentTime
    return true
  }
}

async function createLandmarker({ handLandmarker, vision, modelAssetUrl, numHands }) {
  let lastError

  for (const delegate of TRACKER_DELEGATES) {
    try {
      return await handLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelAssetUrl,
          delegate
        },
        runningMode: 'VIDEO',
        numHands
      })
    } catch (err) {
      lastError = err
    }
  }

  throw lastError
}

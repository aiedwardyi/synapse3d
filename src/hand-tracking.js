import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

const WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'

// Prompts for camera access. MUST be called from a user gesture.
export async function requestCameraStream(constraints = { video: { width: 640, height: 480 } }) {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Your browser does not support camera access.')
  }
  return navigator.mediaDevices.getUserMedia(constraints)
}

// Loads MediaPipe and returns a tracker controller.
export async function createHandTracker({ video, modelAssetUrl, numHands = 2 }) {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL)
  const landmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: modelAssetUrl,
      delegate: 'GPU'
    },
    runningMode: 'VIDEO',
    numHands
  })

  let rafId = null
  let running = false
  let lastTimestamp = 0

  function tick(onLandmarks) {
    if (!running) return

    // detectForVideo requires strictly increasing timestamps in milliseconds.
    const now = performance.now()
    const timestamp = now > lastTimestamp ? now : lastTimestamp + 1
    lastTimestamp = timestamp

    if (video.readyState >= 2) {
      const result = landmarker.detectForVideo(video, timestamp)
      onLandmarks(result)
    }

    rafId = requestAnimationFrame(() => tick(onLandmarks))
  }

  return {
    start(onLandmarks) {
      if (running) return
      running = true
      tick(onLandmarks)
    },
    stop() {
      running = false
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = null
      landmarker.close?.()
    }
  }
}

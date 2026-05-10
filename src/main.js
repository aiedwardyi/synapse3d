import ForceGraph3D from '3d-force-graph'
import { pickVault, getCachedVault, hasVaultPermission, requestVaultPermission, parseVault } from './vault.js'
import { initVaultControls } from './vault-controller.js'
import { requestCameraStream, createHandTracker, stopVideoStream } from './hand-tracking.js'
import { resetTrackingUiAfterError, updateTrackingButtonAfterRender } from './hand-tracking-ui.js'
import { drawFingertipCursor, drawLandmarks } from './hand-overlay.js'
import { createOneEuroFilter, createPinchDetector } from './gestures.js'
import { applyCoverTransform, mirrorLandmarkX } from './landmark-transform.js'
import './style.css'

const HAND_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

const TAG_COLORS = [
  '#4a90e2',
  '#e2a04a',
  '#7ee24a',
  '#e24a90',
  '#a04ae2',
  '#4ae2a0',
  '#e24a4a',
  '#e2e24a'
]

const DEFAULT_COLOR = '#cfd8e8'
const MISSING_COLOR = '#4a3030'
const FINGERTIP_FILTER_OPTIONS = {
  minCutoff: 1.0,
  beta: 0.05,
  dCutoff: 1.0
}
const PINCH_DETECTOR_OPTIONS = {
  enterRatio: 0.45,
  exitRatio: 0.55
}

// Hash the first tag to a palette color. Same tag always = same color.
function colorForTag(tag) {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) | 0
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

function nodeColor(node) {
  if (node.missing) return MISSING_COLOR
  if (node.tags && node.tags.length > 0) return colorForTag(node.tags[0])
  return DEFAULT_COLOR
}

let graph = null
let trackingButton = null
let handTrackingStarted = false

function render(data) {
  if (!graph) {
    graph = ForceGraph3D()(document.getElementById('graph'))
      .backgroundColor('rgba(0,0,0,0)')
      .nodeLabel('label')
      .nodeColor(nodeColor)
      .linkColor(() => '#cfd8e8')
      .linkOpacity(0.3)
  }
  graph.graphData(data)
}

async function loadAndRender(handle) {
  const result = await parseVault(handle)
  console.log('Vault stats:', result.stats)
  render(result)
  updateTrackingButtonAfterRender(trackingButton, handTrackingStarted)
}

function initHandTracking({ button, video, canvas }) {
  button.addEventListener('click', async () => {
    button.disabled = true
    try {
      const cursorFilterX = createOneEuroFilter(FINGERTIP_FILTER_OPTIONS)
      const cursorFilterY = createOneEuroFilter(FINGERTIP_FILTER_OPTIONS)
      const detectPinch = createPinchDetector(PINCH_DETECTOR_OPTIONS)
      let previousPinchState = false

      function resetGestureState() {
        cursorFilterX.reset()
        cursorFilterY.reset()
        detectPinch.reset()
        previousPinchState = false
      }

      const stream = await requestCameraStream()
      video.srcObject = stream
      await video.play()

      const tracker = await createHandTracker({
        video,
        modelAssetUrl: HAND_MODEL_URL
      })

      tracker.start(
        result => {
          const sourceW = video.videoWidth
          const sourceH = video.videoHeight

          if (!Number.isFinite(sourceW) || !Number.isFinite(sourceH) || sourceW === 0 || sourceH === 0) {
            resetGestureState()
            drawLandmarks(canvas, [])
            return
          }

          const rawHands = (result?.landmarks || []).filter(isDrawableHand)

          const transformedHands = rawHands.map(landmarks => (
            transformHandLandmarks(
              landmarks,
              sourceW,
              sourceH,
              canvas.width,
              canvas.height
            )
          ))

          drawLandmarks(canvas, transformedHands)

          const firstHand = transformedHands[0]
          const sourceHand = scaleHandToSourcePixels(rawHands[0], sourceW, sourceH)
          const indexTip = firstHand?.[8]
          if (!sourceHand || !isDrawablePoint(indexTip)) {
            resetGestureState()
            return
          }

          const time = performance.now() / 1000
          const cursorPoint = {
            x: cursorFilterX(indexTip.x, time),
            y: cursorFilterY(indexTip.y, time)
          }
          const isPinching = detectPinch(sourceHand)

          if (isPinching !== previousPinchState) {
            console.log('Pinch state:', isPinching)
            previousPinchState = isPinching
          }

          drawFingertipCursor(canvas, cursorPoint, isPinching)
        },
        err => {
          console.warn('Hand tracking runtime error:', err)
          resetTrackingUiAfterError({ button, video, canvas, stopVideoStream })
          handTrackingStarted = false
        }
      )

      handTrackingStarted = true
      button.hidden = true
      video.hidden = false
      canvas.hidden = false
    } catch (err) {
      stopVideoStream(video)
      console.warn('Hand tracking failed to start:', err)
      button.disabled = false
    }
  })
}

function scaleHandToSourcePixels(landmarks, sourceW, sourceH) {
  if (!isDrawableHand(landmarks)) return null

  return landmarks.map(landmark => ({
    x: landmark.x * sourceW,
    y: landmark.y * sourceH
  }))
}

function transformHandLandmarks(landmarks, sourceW, sourceH, containerW, containerH) {
  return landmarks.map(landmark => {
    const transformedLandmark = applyCoverTransform(
      landmark,
      sourceW,
      sourceH,
      containerW,
      containerH
    )

    return mirrorLandmarkX(transformedLandmark)
  })
}

function isDrawablePoint(point) {
  return point &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y)
}

function isDrawableHand(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < 21) return false

  for (let i = 0; i < 21; i++) {
    if (!isDrawablePoint(landmarks[i])) return false
  }

  return true
}

function syncOverlayCanvasSize(canvas) {
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
}

async function init() {
  const pickButton = document.getElementById('pick-vault')
  const changeButton = document.getElementById('change-vault')
  trackingButton = document.getElementById('enable-tracking')
  const handVideo = document.getElementById('hand-video')
  const handCanvas = document.getElementById('hand-overlay')

  syncOverlayCanvasSize(handCanvas)
  window.addEventListener('resize', () => syncOverlayCanvasSize(handCanvas))

  await initVaultControls({
    pickButton,
    changeButton,
    pickVault,
    getCachedVault,
    hasVaultPermission,
    requestVaultPermission,
    loadAndRender
  })

  initHandTracking({
    button: trackingButton,
    video: handVideo,
    canvas: handCanvas
  })
}

init()

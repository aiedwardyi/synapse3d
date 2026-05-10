import ForceGraph3D from '3d-force-graph'
import { pickVault, getCachedVault, hasVaultPermission, requestVaultPermission, parseVault } from './vault.js'
import { initVaultControls } from './vault-controller.js'
import { requestCameraStream, createHandTracker, stopVideoStream } from './hand-tracking.js'
import { resetTrackingUiAfterError, updateTrackingButtonAfterRender } from './hand-tracking-ui.js'
import { drawLandmarks } from './hand-overlay.js'
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
      const stream = await requestCameraStream()
      video.srcObject = stream
      await video.play()

      const tracker = await createHandTracker({
        video,
        modelAssetUrl: HAND_MODEL_URL
      })

      tracker.start(
        result => {
          drawLandmarks(canvas, result?.landmarks || [])
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

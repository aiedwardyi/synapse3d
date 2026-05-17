import ForceGraph3D from '3d-force-graph'
import * as THREE from 'three'
import { pickVault, getCachedVault, hasVaultPermission, requestVaultPermission, parseVault } from './vault.js'
import { initVaultControls } from './vault-controller.js'
import { requestCameraStream, createHandTracker, stopVideoStream } from './hand-tracking.js'
import { resetTrackingUiAfterError, updateTrackingButtonAfterRender } from './hand-tracking-ui.js'
import { drawFingertipCursor, drawLandmarks } from './hand-overlay.js'
import { createOneEuroFilter, createPalmOpenDetector, createPinchDetector } from './gestures.js'
import { createDragController } from './drag.js'
import { createOrbitController } from './camera-orbit.js'
import { createZoomController } from './camera-zoom.js'
import { bucketHandsByHandedness } from './handedness.js'
import { findNodeAtScreenPoint } from './gesture-raycasting.js'
import { applyCoverTransform, mirrorLandmarkX } from './landmark-transform.js'
import { createMaterialTracker } from './material-tracker.js'
import { createNodeMesh, setNodeMeshScale, updateNodeMesh } from './node-mesh.js'
import { createNodeSelectionHit } from './node-selection-hit.js'
import { createPinchSelectionAttempt } from './pinch-selection-attempt.js'
import { createSelectionPanel } from './selection-panel.js'
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
const HIGHLIGHT_COLOR = 0xffffff
const FINGERTIP_FILTER_OPTIONS = {
  minCutoff: 1.0,
  beta: 0.05,
  dCutoff: 1.0
}
const PINCH_DETECTOR_OPTIONS = {
  enterRatio: 0.45,
  exitRatio: 0.55
}
const PALM_DETECTOR_OPTIONS = {
  enterRatio: 0.75,
  exitRatio: 0.55
}
const PALM_FILTER_OPTIONS = {
  minCutoff: 1.0,
  beta: 0.05,
  dCutoff: 1.0
}
const SPREAD_FILTER_OPTIONS = {
  minCutoff: 1.0,
  beta: 0.05,
  dCutoff: 1.0
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
let selectionPanel = null
let currentSelection = null
let trackingButton = null
let handTrackingStarted = false
const raycaster = new THREE.Raycaster()
const drag = createDragController()
const orbit = createOrbitController()
const zoom = createZoomController()
const nodeMaterials = createMaterialTracker()
const nodeMeshes = new Map()

function render(data) {
  if (!graph) {
    graph = ForceGraph3D()(document.getElementById('graph'))
      .backgroundColor('rgba(0,0,0,0)')
      .nodeLabel('label')
      .nodeThreeObject(makeNodeMesh)
      .onNodeClick(selectGraphNode)
      .linkColor(() => '#cfd8e8')
      .linkOpacity(0.3)
  }
  clearSelection()
  graph.graphData(data)
  syncNodeMeshes(data.nodes || [])
}

function makeNodeMesh(node) {
  const mesh = createNodeMesh(node, {
    color: nodeColor(node),
    materialTracker: nodeMaterials
  })
  nodeMeshes.set(node.id, mesh)
  return mesh
}

function syncNodeMeshes(nodes) {
  const activeNodeIds = new Set()

  for (const node of nodes) {
    activeNodeIds.add(node.id)

    const mesh = nodeMeshes.get(node.id)
    if (mesh) updateNodeMesh(mesh, node, nodeColor(node))
  }

  for (const [nodeId, mesh] of nodeMeshes) {
    if (activeNodeIds.has(nodeId)) continue

    nodeMaterials.dispose(mesh.material)
    nodeMeshes.delete(nodeId)
  }
}

function applyHighlight(mesh) {
  if (!Number.isFinite(mesh.userData.originalColor)) {
    mesh.userData.originalColor = mesh.material.color.getHex()
  }

  mesh.material.color.setHex(HIGHLIGHT_COLOR)
  setNodeMeshScale(mesh, 1.5)
}

function revertHighlight(mesh) {
  if (Number.isFinite(mesh.userData.originalColor)) {
    mesh.material.color.setHex(mesh.userData.originalColor)
  }

  setNodeMeshScale(mesh, 1)
}

function selectNode(hit) {
  if (hit && currentSelection?.mesh === hit.mesh) return

  if (currentSelection) {
    revertHighlight(currentSelection.mesh)
  }

  currentSelection = hit || null

  if (hit) {
    applyHighlight(hit.mesh)
    selectionPanel.show(hit.node)
  }
}

function selectGraphNode(node) {
  const hit = createNodeSelectionHit(node, nodeMeshes)
  if (hit) selectNode(hit)
}

function clearSelection() {
  if (currentSelection) {
    revertHighlight(currentSelection.mesh)
    currentSelection = null
  }

  selectionPanel?.hide()
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
      const palmFilterX = createOneEuroFilter(PALM_FILTER_OPTIONS)
      const palmFilterY = createOneEuroFilter(PALM_FILTER_OPTIONS)
      const spreadFilter = createOneEuroFilter(SPREAD_FILTER_OPTIONS)
      const detectPinch = createPinchDetector(PINCH_DETECTOR_OPTIONS)
      const detectPinchSecondary = createPinchDetector(PINCH_DETECTOR_OPTIONS)
      const detectPalmOpenPrimary = createPalmOpenDetector(PALM_DETECTOR_OPTIONS)
      const detectPalmOpenSecondary = createPalmOpenDetector(PALM_DETECTOR_OPTIONS)
      const selectionAttempt = createPinchSelectionAttempt()
      let previousPinchState = false

      function resetGestureState() {
        cursorFilterX.reset()
        cursorFilterY.reset()
        palmFilterX.reset()
        palmFilterY.reset()
        spreadFilter.reset()
        detectPinch.reset()
        detectPinchSecondary.reset()
        detectPalmOpenPrimary.reset()
        detectPalmOpenSecondary.reset()
        selectionAttempt.reset()
        drag.endDrag()
        orbit.endOrbit()
        zoom.endZoom()
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

          const allLandmarks = result?.landmarks || []
          const transformedByIndex = allLandmarks.map(landmarks => {
            if (!isDrawableHand(landmarks)) return null
            return transformHandLandmarks(landmarks, sourceW, sourceH, canvas.width, canvas.height)
          })
          const drawableHands = transformedByIndex.filter(hand => hand !== null)
          drawLandmarks(canvas, drawableHands)

          // Right hand is the primary manipulator. Left is a fallback when right is absent or unusable.
          const bucketed = bucketHandsByHandedness(result)
          const usableRight = isUsableBucket(bucketed.right, allLandmarks, transformedByIndex) ? bucketed.right : null
          const usableLeft = isUsableBucket(bucketed.left, allLandmarks, transformedByIndex) ? bucketed.left : null
          const primaryBucket = usableRight || usableLeft
          const secondaryBucket = usableRight ? usableLeft : null

          if (!primaryBucket) {
            resetGestureState()
            return
          }

          const primaryLandmarks = allLandmarks[primaryBucket.index]
          const primaryTransformed = transformedByIndex[primaryBucket.index]
          const primarySource = scaleHandToSourcePixels(primaryLandmarks, sourceW, sourceH)
          const indexTip = primaryTransformed[8]
          if (!primarySource || !isDrawablePoint(indexTip)) {
            resetGestureState()
            return
          }

          const time = performance.now() / 1000
          const cursorPoint = {
            x: cursorFilterX(indexTip.x, time),
            y: cursorFilterY(indexTip.y, time)
          }
          const isPinching = detectPinch(primarySource)
          const isPrimaryPalmOpen = detectPalmOpenPrimary(primarySource)

          if (isPinching !== previousPinchState) {
            console.log('Pinch state:', isPinching)
            if (!isPinching) {
              selectionAttempt.reset()
              drag.endDrag()
            }
            previousPinchState = isPinching
          }

          const primaryWrist = primaryTransformed[0]
          const primaryPalmPoint = {
            x: palmFilterX(clampUnit(primaryWrist.x), time),
            y: palmFilterY(clampUnit(primaryWrist.y), time)
          }

          let secondaryAvailable = false
          let isSecondaryPalmOpen = false
          let isSecondaryPinching = false
          let filteredSpread = 0
          if (secondaryBucket) {
            const secondarySource = scaleHandToSourcePixels(
              allLandmarks[secondaryBucket.index],
              sourceW,
              sourceH
            )
            if (secondarySource) {
              secondaryAvailable = true
              isSecondaryPalmOpen = detectPalmOpenSecondary(secondarySource)
              isSecondaryPinching = detectPinchSecondary(secondarySource)
              const secondaryTransformed = transformedByIndex[secondaryBucket.index]
              const secondaryWrist = secondaryTransformed[0]
              const dx = clampUnit(primaryWrist.x) - clampUnit(secondaryWrist.x)
              const dy = clampUnit(primaryWrist.y) - clampUnit(secondaryWrist.y)
              filteredSpread = spreadFilter(Math.hypot(dx, dy), time)
            }
          }
          if (!secondaryAvailable) {
            detectPalmOpenSecondary.reset()
            detectPinchSecondary.reset()
          }

          // Pinch on either hand ends zoom. Pinch select/drag stays on the primary hand only.
          const isAnyPinching = isPinching || isSecondaryPinching
          const shouldZoom =
            !isAnyPinching &&
            secondaryAvailable &&
            isPrimaryPalmOpen &&
            isSecondaryPalmOpen &&
            graph !== null
          const shouldOrbit =
            !isPinching &&
            !shouldZoom &&
            isPrimaryPalmOpen &&
            graph !== null

          if (shouldZoom && !zoom.isZooming()) {
            const lookAtTarget = graph.controls().target.clone()
            zoom.beginZoom(filteredSpread, graph.camera(), lookAtTarget)
          } else if (!shouldZoom && zoom.isZooming()) {
            zoom.endZoom()
            spreadFilter.reset()
          }
          if (zoom.isZooming()) {
            zoom.updateZoom(filteredSpread, graph.camera())
          }

          if (shouldOrbit && !orbit.isOrbiting()) {
            const lookAtTarget = graph.controls().target.clone()
            orbit.beginOrbit(primaryPalmPoint, graph.camera(), lookAtTarget)
          } else if (!shouldOrbit && orbit.isOrbiting()) {
            orbit.endOrbit()
          }
          if (orbit.isOrbiting()) {
            orbit.updateOrbit(primaryPalmPoint, graph.camera())
          }

          if (selectionAttempt.shouldAttempt(isPinching) && isViewportPoint(cursorPoint) && graph) {
            const hit = findNodeAtScreenPoint(
              cursorPoint,
              graph.camera(),
              graph.scene(),
              raycaster
            )
            if (hit) {
              selectNode(hit)
              drag.beginDrag(hit, graph.camera())
              selectionAttempt.recordHit()
            }
          }

          if (isPinching && drag.isDragging() && isViewportPoint(cursorPoint) && graph) {
            drag.updateDrag(cursorPoint, graph.camera(), raycaster)
            graph.d3ReheatSimulation()
          }

          drawFingertipCursor(canvas, cursorPoint, isPinching)
        },
        err => {
          console.warn('Hand tracking runtime error:', err)
          resetGestureState()
          resetTrackingUiAfterError({ button, video, canvas, stopVideoStream })
          handTrackingStarted = false
        }
      )

      handTrackingStarted = true
      button.hidden = true
      video.hidden = false
      canvas.hidden = false
    } catch (err) {
      drag.endDrag()
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

function isViewportPoint(point) {
  return isDrawablePoint(point) &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1
}

function clampUnit(value) {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function isDrawableHand(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < 21) return false

  for (let i = 0; i < 21; i++) {
    if (!isDrawablePoint(landmarks[i])) return false
  }

  return true
}

function isUsableBucket(bucket, allLandmarks, transformedByIndex) {
  if (!bucket) return false
  if (!transformedByIndex[bucket.index]) return false
  if (!isDrawableHand(allLandmarks[bucket.index])) return false
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
  const selectionPanelElement = document.getElementById('selection-panel')
  selectionPanel = createSelectionPanel(selectionPanelElement)

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

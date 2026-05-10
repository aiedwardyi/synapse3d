const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]
]

const LANDMARK_COLOR = '#4a90e2'
const CONNECTION_COLOR = '#cfd8e8'
const LANDMARK_RADIUS = 4
const CONNECTION_WIDTH = 2
const FINGERTIP_CURSOR_COLOR = '#4a90e2'
const FINGERTIP_CURSOR_PINCH_COLOR = '#e2a04a'
const FINGERTIP_CURSOR_RADIUS = 14
const FINGERTIP_CURSOR_WIDTH = 3

// Maps a container-normalized landmark to canvas coordinates.
export function normalizeLandmark(landmark, width, height) {
  return {
    x: clamp(landmark.x * width, 0, Math.max(width - 1, 0)),
    y: clamp(landmark.y * height, 0, Math.max(height - 1, 0))
  }
}

// Clears the canvas and draws every hand as dots plus skeleton lines.
export function drawLandmarks(canvas, hands) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (!hands || hands.length === 0) return

  for (const landmarks of hands) {
    if (!isDrawableHand(landmarks)) continue

    drawConnections(ctx, landmarks, canvas.width, canvas.height)
    drawPoints(ctx, landmarks, canvas.width, canvas.height)
  }
}

export function drawFingertipCursor(canvas, point, isPinching) {
  const ctx = canvas.getContext('2d')
  if (!ctx || !isDrawablePoint(point)) return

  const cursorPoint = normalizeLandmark(point, canvas.width, canvas.height)

  ctx.strokeStyle = isPinching ? FINGERTIP_CURSOR_PINCH_COLOR : FINGERTIP_CURSOR_COLOR
  ctx.lineWidth = FINGERTIP_CURSOR_WIDTH
  ctx.beginPath()
  ctx.arc(cursorPoint.x, cursorPoint.y, FINGERTIP_CURSOR_RADIUS, 0, Math.PI * 2)
  ctx.stroke()
}

function drawConnections(ctx, landmarks, width, height) {
  ctx.strokeStyle = CONNECTION_COLOR
  ctx.lineWidth = CONNECTION_WIDTH

  for (const [start, end] of HAND_CONNECTIONS) {
    const a = normalizeLandmark(landmarks[start], width, height)
    const b = normalizeLandmark(landmarks[end], width, height)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
}

function drawPoints(ctx, landmarks, width, height) {
  ctx.fillStyle = LANDMARK_COLOR
  for (const landmark of landmarks) {
    const point = normalizeLandmark(landmark, width, height)
    ctx.beginPath()
    ctx.arc(point.x, point.y, LANDMARK_RADIUS, 0, Math.PI * 2)
    ctx.fill()
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
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

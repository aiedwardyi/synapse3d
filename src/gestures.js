const WRIST = 0
const THUMB_TIP = 4
const INDEX_TIP = 8
const MIDDLE_MCP = 9
const MIDDLE_TIP = 12
const RING_TIP = 16
const PINKY_TIP = 20

const PALM_FINGER_TIPS = [INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP]

export function pinchRatio(landmarks) {
  const thumbTip = landmarks[THUMB_TIP]
  const indexTip = landmarks[INDEX_TIP]
  const wrist = landmarks[WRIST]
  const middleMcp = landmarks[MIDDLE_MCP]
  const handScale = pointDistance(wrist, middleMcp)

  if (handScale === 0) return Number.POSITIVE_INFINITY

  return pointDistance(thumbTip, indexTip) / handScale
}

export function palmOpenness(landmarks) {
  const wrist = landmarks[WRIST]
  const middleMcp = landmarks[MIDDLE_MCP]
  const handScale = pointDistance(wrist, middleMcp)

  if (handScale === 0) return Number.POSITIVE_INFINITY

  let totalTipDistance = 0
  for (const tipIndex of PALM_FINGER_TIPS) {
    totalTipDistance += pointDistance(landmarks[tipIndex], middleMcp)
  }

  return (totalTipDistance / PALM_FINGER_TIPS.length) / handScale
}

export function createPinchDetector({
  enterRatio = 0.45,
  exitRatio = 0.55
} = {}) {
  let isPinching = false

  function detectPinch(landmarks) {
    const ratio = pinchRatio(landmarks)

    if (!isPinching && ratio < enterRatio) {
      isPinching = true
    } else if (isPinching && ratio > exitRatio) {
      isPinching = false
    }

    return isPinching
  }

  detectPinch.reset = () => {
    isPinching = false
  }

  return detectPinch
}

export function createPalmOpenDetector({
  enterRatio = 2.2,
  exitRatio = 1.8
} = {}) {
  let isPalmOpen = false

  function detectPalmOpen(landmarks) {
    const ratio = palmOpenness(landmarks)

    if (!isPalmOpen && ratio > enterRatio) {
      isPalmOpen = true
    } else if (isPalmOpen && ratio < exitRatio) {
      isPalmOpen = false
    }

    return isPalmOpen
  }

  detectPalmOpen.reset = () => {
    isPalmOpen = false
  }

  return detectPalmOpen
}

function smoothingFactor(timeElapsed, cutoff) {
  const r = 2 * Math.PI * cutoff * timeElapsed
  return r / (r + 1)
}

function exponentialSmoothing(alpha, value, valuePrev) {
  return alpha * value + (1 - alpha) * valuePrev
}

export function createOneEuroFilter({
  minCutoff = 1.0,
  beta = 0.0,
  dCutoff = 1.0
} = {}) {
  let valuePrev = null
  let derivativePrev = 0
  let timePrev = null

  function filter(value, time) {
    if (timePrev === null) {
      timePrev = time
      valuePrev = value
      return value
    }

    const timeElapsed = time - timePrev
    if (timeElapsed <= 0) return valuePrev

    const alphaD = smoothingFactor(timeElapsed, dCutoff)
    const derivative = (value - valuePrev) / timeElapsed
    const derivativeFiltered = exponentialSmoothing(
      alphaD,
      derivative,
      derivativePrev
    )

    const cutoff = minCutoff + beta * Math.abs(derivativeFiltered)
    const alpha = smoothingFactor(timeElapsed, cutoff)
    const valueFiltered = exponentialSmoothing(alpha, value, valuePrev)

    valuePrev = valueFiltered
    derivativePrev = derivativeFiltered
    timePrev = time
    return valueFiltered
  }

  filter.reset = () => {
    valuePrev = null
    derivativePrev = 0
    timePrev = null
  }

  return filter
}

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

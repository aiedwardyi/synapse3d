import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createOneEuroFilter,
  createPalmOpenDetector,
  createPinchDetector,
  palmOpenness,
  pinchRatio
} from '../src/gestures.js'

test('pinchRatio returns zero when thumb and index tips overlap', () => {
  const hand = createHand({
    wrist: { x: 0, y: 0 },
    middleMcp: { x: 0, y: 1 },
    thumbTip: { x: 0.5, y: 0.5 },
    indexTip: { x: 0.5, y: 0.5 }
  })

  assert.equal(pinchRatio(hand), 0)
})

test('pinchRatio is greater than one when fingertips are far apart relative to hand scale', () => {
  const hand = createHand({
    wrist: { x: 0, y: 0 },
    middleMcp: { x: 0, y: 1 },
    thumbTip: { x: 0, y: 0 },
    indexTip: { x: 2, y: 0 }
  })

  assert.ok(pinchRatio(hand) > 1)
})

test('pinchRatio is scale invariant', () => {
  const hand = createHand({
    wrist: { x: 0.2, y: 0.2 },
    middleMcp: { x: 0.2, y: 0.7 },
    thumbTip: { x: 0.5, y: 0.4 },
    indexTip: { x: 0.8, y: 0.4 }
  })
  const scaledHand = scaleHand(hand, { x: 0.5, y: 0.5 }, 2)

  assertApprox(pinchRatio(scaledHand), pinchRatio(hand))
})

test('pinchRatio returns infinity when hand scale is zero', () => {
  const hand = createHand({
    wrist: { x: 1, y: 1 },
    middleMcp: { x: 1, y: 1 },
    thumbTip: { x: 1, y: 1 },
    indexTip: { x: 2, y: 1 }
  })

  assert.equal(pinchRatio(hand), Number.POSITIVE_INFINITY)
})

test('createPinchDetector enters and exits pinching across hysteresis thresholds', () => {
  const detectPinch = createPinchDetector({
    enterRatio: 0.45,
    exitRatio: 0.55
  })

  assert.equal(detectPinch(createRatioHand(0.5)), false)
  assert.equal(detectPinch(createRatioHand(0.4)), true)
  assert.equal(detectPinch(createRatioHand(0.6)), false)
})

test('createPinchDetector holds state while ratio bounces inside hysteresis band', () => {
  const detectPinch = createPinchDetector({
    enterRatio: 0.45,
    exitRatio: 0.55
  })

  assert.equal(detectPinch(createRatioHand(0.4)), true)
  assert.equal(detectPinch(createRatioHand(0.48)), true)
  assert.equal(detectPinch(createRatioHand(0.52)), true)
  assert.equal(detectPinch(createRatioHand(0.6)), false)
  assert.equal(detectPinch(createRatioHand(0.52)), false)
  assert.equal(detectPinch(createRatioHand(0.48)), false)
})

test('createPinchDetector reset clears pinch hysteresis state', () => {
  const detectPinch = createPinchDetector({
    enterRatio: 0.45,
    exitRatio: 0.55
  })

  assert.equal(detectPinch(createRatioHand(0.4)), true)
  detectPinch.reset()

  assert.equal(detectPinch(createRatioHand(0.5)), false)
})

test('palmOpenness returns a high ratio when fingertips are far from middle MCP', () => {
  const hand = createPalmHand({
    wrist: { x: 0, y: 0 },
    middleMcp: { x: 0, y: 1 },
    indexTip: { x: 0, y: 4 },
    middleTip: { x: 0, y: 4 },
    ringTip: { x: 0, y: 4 },
    pinkyTip: { x: 0, y: 4 }
  })

  assert.equal(palmOpenness(hand), 3)
})

test('palmOpenness returns a low ratio when fingertips are folded near middle MCP', () => {
  const hand = createPalmHand({
    wrist: { x: 0, y: 0 },
    middleMcp: { x: 0, y: 1 },
    indexTip: { x: 0, y: 1.2 },
    middleTip: { x: 0, y: 1.2 },
    ringTip: { x: 0, y: 1.2 },
    pinkyTip: { x: 0, y: 1.2 }
  })

  assertApprox(palmOpenness(hand), 0.2)
})

test('palmOpenness ignores the thumb tip', () => {
  const baseFingers = {
    wrist: { x: 0, y: 0 },
    middleMcp: { x: 0, y: 1 },
    indexTip: { x: 0, y: 4 },
    middleTip: { x: 0, y: 4 },
    ringTip: { x: 0, y: 4 },
    pinkyTip: { x: 0, y: 4 }
  }

  const handThumbClose = createPalmHand({ ...baseFingers, thumbTip: { x: 0, y: 1 } })
  const handThumbFar = createPalmHand({ ...baseFingers, thumbTip: { x: 0, y: 100 } })

  assert.equal(palmOpenness(handThumbClose), palmOpenness(handThumbFar))
})

test('palmOpenness is scale invariant', () => {
  const hand = createPalmHand({
    wrist: { x: 0.1, y: 0.1 },
    middleMcp: { x: 0.1, y: 0.5 },
    indexTip: { x: 0.0, y: 1.3 },
    middleTip: { x: 0.1, y: 1.4 },
    ringTip: { x: 0.2, y: 1.3 },
    pinkyTip: { x: 0.3, y: 1.2 }
  })
  const scaledHand = scaleHand(hand, { x: 0.5, y: 0.5 }, 2)

  assertApprox(palmOpenness(scaledHand), palmOpenness(hand))
})

test('palmOpenness returns infinity when hand scale is zero', () => {
  const hand = createPalmHand({
    wrist: { x: 1, y: 1 },
    middleMcp: { x: 1, y: 1 },
    indexTip: { x: 2, y: 1 },
    middleTip: { x: 2, y: 1 },
    ringTip: { x: 2, y: 1 },
    pinkyTip: { x: 2, y: 1 }
  })

  assert.equal(palmOpenness(hand), Number.POSITIVE_INFINITY)
})

test('createPalmOpenDetector enters open state when ratio exceeds enterRatio from below', () => {
  const detectPalmOpen = createPalmOpenDetector({
    enterRatio: 2.2,
    exitRatio: 1.8
  })

  assert.equal(detectPalmOpen(createPalmRatioHand(2.0)), false)
  assert.equal(detectPalmOpen(createPalmRatioHand(2.3)), true)
})

test('createPalmOpenDetector holds state while ratio bounces inside hysteresis band', () => {
  const detectPalmOpen = createPalmOpenDetector({
    enterRatio: 2.2,
    exitRatio: 1.8
  })

  assert.equal(detectPalmOpen(createPalmRatioHand(2.3)), true)
  assert.equal(detectPalmOpen(createPalmRatioHand(2.0)), true)
  assert.equal(detectPalmOpen(createPalmRatioHand(1.85)), true)
  assert.equal(detectPalmOpen(createPalmRatioHand(1.7)), false)
  assert.equal(detectPalmOpen(createPalmRatioHand(2.0)), false)
  assert.equal(detectPalmOpen(createPalmRatioHand(2.15)), false)
})

test('createPalmOpenDetector exits open state when ratio drops below exitRatio', () => {
  const detectPalmOpen = createPalmOpenDetector({
    enterRatio: 2.2,
    exitRatio: 1.8
  })

  assert.equal(detectPalmOpen(createPalmRatioHand(2.5)), true)
  assert.equal(detectPalmOpen(createPalmRatioHand(1.7)), false)
})

test('createPalmOpenDetector reset clears open hysteresis state', () => {
  const detectPalmOpen = createPalmOpenDetector({
    enterRatio: 2.2,
    exitRatio: 1.8
  })

  assert.equal(detectPalmOpen(createPalmRatioHand(2.5)), true)
  detectPalmOpen.reset()

  assert.equal(detectPalmOpen(createPalmRatioHand(2.0)), false)
})

test('createOneEuroFilter returns first input unchanged', () => {
  const filter = createOneEuroFilter()

  assert.equal(filter(10, 1), 10)
})

test('createOneEuroFilter keeps constant input constant', () => {
  const filter = createOneEuroFilter()

  assert.equal(filter(5, 0), 5)
  assert.equal(filter(5, 0.1), 5)
  assert.equal(filter(5, 0.2), 5)
})

test('createOneEuroFilter returns previous value for identical timestamps', () => {
  const filter = createOneEuroFilter()

  assert.equal(filter(1, 1), 1)
  assert.equal(filter(10, 1), 1)
})

test('createOneEuroFilter smooths step input toward the new value without overshoot', () => {
  const filter = createOneEuroFilter()
  const first = filter(0, 0)
  const second = filter(10, 0.1)
  const third = filter(10, 0.2)

  assert.equal(first, 0)
  assert.ok(second > 0)
  assert.ok(second < 10)
  assert.ok(third > second)
  assert.ok(third < 10)
})

test('createOneEuroFilter reset clears prior smoothing history', () => {
  const filter = createOneEuroFilter()

  assert.equal(filter(0, 0), 0)
  assert.ok(filter(10, 0.1) < 10)
  filter.reset()

  assert.equal(filter(10, 0.2), 10)
})

function createRatioHand(ratio) {
  return createHand({
    wrist: { x: 0, y: 0 },
    middleMcp: { x: 0, y: 1 },
    thumbTip: { x: 0, y: 0 },
    indexTip: { x: ratio, y: 0 }
  })
}

function createPalmRatioHand(ratio) {
  const tip = { x: 0, y: 1 + ratio }
  return createPalmHand({
    wrist: { x: 0, y: 0 },
    middleMcp: { x: 0, y: 1 },
    indexTip: tip,
    middleTip: tip,
    ringTip: tip,
    pinkyTip: tip
  })
}

function createHand({
  wrist = { x: 0, y: 0 },
  thumbTip = { x: 0, y: 0 },
  indexTip = { x: 0, y: 0 },
  middleMcp = { x: 0, y: 1 }
} = {}) {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }))
  landmarks[0] = wrist
  landmarks[4] = thumbTip
  landmarks[8] = indexTip
  landmarks[9] = middleMcp
  return landmarks
}

function createPalmHand({
  wrist = { x: 0, y: 0 },
  thumbTip = { x: 0, y: 0 },
  indexTip = { x: 0, y: 1 },
  middleMcp = { x: 0, y: 1 },
  middleTip = { x: 0, y: 1 },
  ringTip = { x: 0, y: 1 },
  pinkyTip = { x: 0, y: 1 }
} = {}) {
  const landmarks = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }))
  landmarks[0] = wrist
  landmarks[4] = thumbTip
  landmarks[8] = indexTip
  landmarks[9] = middleMcp
  landmarks[12] = middleTip
  landmarks[16] = ringTip
  landmarks[20] = pinkyTip
  return landmarks
}

function scaleHand(landmarks, center, scale) {
  return landmarks.map(landmark => ({
    x: center.x + (landmark.x - center.x) * scale,
    y: center.y + (landmark.y - center.y) * scale
  }))
}

function assertApprox(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-12, `expected ${actual} to be close to ${expected}`)
}

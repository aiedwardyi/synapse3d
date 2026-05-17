import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bucketHandsByHandedness } from '../src/handedness.js'

function makeLandmarks(seed) {
  return Array.from({ length: 21 }, (_, i) => ({ x: seed + i * 0.001, y: seed + i * 0.001 }))
}

function makeResult({ landmarks = [], handedness = [] } = {}) {
  return { landmarks, handedness }
}

test('returns both slots filled when one hand is labeled Right and the other Left', () => {
  const rightLandmarks = makeLandmarks(0.1)
  const leftLandmarks = makeLandmarks(0.2)
  const result = makeResult({
    landmarks: [rightLandmarks, leftLandmarks],
    handedness: [
      [{ categoryName: 'Right', score: 0.95 }],
      [{ categoryName: 'Left', score: 0.92 }]
    ]
  })

  const bucketed = bucketHandsByHandedness(result)

  assert.equal(bucketed.right.index, 0)
  assert.equal(bucketed.right.landmarks, rightLandmarks)
  assert.equal(bucketed.left.index, 1)
  assert.equal(bucketed.left.landmarks, leftLandmarks)
})

test('preserves bucket assignment regardless of array order', () => {
  const leftLandmarks = makeLandmarks(0.2)
  const rightLandmarks = makeLandmarks(0.1)
  const result = makeResult({
    landmarks: [leftLandmarks, rightLandmarks],
    handedness: [
      [{ categoryName: 'Left', score: 0.92 }],
      [{ categoryName: 'Right', score: 0.95 }]
    ]
  })

  const bucketed = bucketHandsByHandedness(result)

  assert.equal(bucketed.left.index, 0)
  assert.equal(bucketed.right.index, 1)
})

test('returns left null and right populated when only a Right hand is detected', () => {
  const rightLandmarks = makeLandmarks(0.1)
  const result = makeResult({
    landmarks: [rightLandmarks],
    handedness: [[{ categoryName: 'Right', score: 0.95 }]]
  })

  const bucketed = bucketHandsByHandedness(result)

  assert.equal(bucketed.left, null)
  assert.equal(bucketed.right.index, 0)
  assert.equal(bucketed.right.landmarks, rightLandmarks)
})

test('returns left populated and right null when only a Left hand is detected', () => {
  const leftLandmarks = makeLandmarks(0.2)
  const result = makeResult({
    landmarks: [leftLandmarks],
    handedness: [[{ categoryName: 'Left', score: 0.9 }]]
  })

  const bucketed = bucketHandsByHandedness(result)

  assert.equal(bucketed.left.index, 0)
  assert.equal(bucketed.left.landmarks, leftLandmarks)
  assert.equal(bucketed.right, null)
})

test('returns both null when no hands are detected', () => {
  const result = makeResult({ landmarks: [], handedness: [] })

  const bucketed = bucketHandsByHandedness(result)

  assert.equal(bucketed.left, null)
  assert.equal(bucketed.right, null)
})

test('returns both null when result is null', () => {
  const bucketed = bucketHandsByHandedness(null)

  assert.equal(bucketed.left, null)
  assert.equal(bucketed.right, null)
})

test('returns both null when result is undefined', () => {
  const bucketed = bucketHandsByHandedness(undefined)

  assert.equal(bucketed.left, null)
  assert.equal(bucketed.right, null)
})

test('returns both null when handedness array is missing', () => {
  const result = { landmarks: [makeLandmarks(0.1)] }

  const bucketed = bucketHandsByHandedness(result)

  assert.equal(bucketed.left, null)
  assert.equal(bucketed.right, null)
})

test('returns both null when landmarks array is missing', () => {
  const result = { handedness: [[{ categoryName: 'Right', score: 0.9 }]] }

  const bucketed = bucketHandsByHandedness(result)

  assert.equal(bucketed.left, null)
  assert.equal(bucketed.right, null)
})

test('when both hands are labeled Right, keeps the higher-confidence one in the right slot and drops the lower one to null rather than the opposite slot', () => {
  const firstLandmarks = makeLandmarks(0.1)
  const secondLandmarks = makeLandmarks(0.2)
  const result = makeResult({
    landmarks: [firstLandmarks, secondLandmarks],
    handedness: [
      [{ categoryName: 'Right', score: 0.6 }],
      [{ categoryName: 'Right', score: 0.95 }]
    ]
  })

  const bucketed = bucketHandsByHandedness(result)

  assert.equal(bucketed.right.index, 1)
  assert.equal(bucketed.right.landmarks, secondLandmarks)
  assert.equal(bucketed.left, null)
})

test('when both hands are labeled Left, keeps the higher-confidence one in the left slot and drops the lower one to null rather than the opposite slot', () => {
  const firstLandmarks = makeLandmarks(0.1)
  const secondLandmarks = makeLandmarks(0.2)
  const result = makeResult({
    landmarks: [firstLandmarks, secondLandmarks],
    handedness: [
      [{ categoryName: 'Left', score: 0.95 }],
      [{ categoryName: 'Left', score: 0.6 }]
    ]
  })

  const bucketed = bucketHandsByHandedness(result)

  assert.equal(bucketed.left.index, 0)
  assert.equal(bucketed.left.landmarks, firstLandmarks)
  assert.equal(bucketed.right, null)
})

test('returns null for a slot when its handedness inner array is empty', () => {
  const firstLandmarks = makeLandmarks(0.1)
  const secondLandmarks = makeLandmarks(0.2)
  const result = makeResult({
    landmarks: [firstLandmarks, secondLandmarks],
    handedness: [
      [{ categoryName: 'Right', score: 0.95 }],
      []
    ]
  })

  const bucketed = bucketHandsByHandedness(result)

  assert.equal(bucketed.right.index, 0)
  assert.equal(bucketed.left, null)
})

test('returns null for a slot when its handedness inner entry lacks categoryName', () => {
  const firstLandmarks = makeLandmarks(0.1)
  const result = makeResult({
    landmarks: [firstLandmarks],
    handedness: [[{ score: 0.95 }]]
  })

  const bucketed = bucketHandsByHandedness(result)

  assert.equal(bucketed.left, null)
  assert.equal(bucketed.right, null)
})

test('returns null for a slot when categoryName is neither Left nor Right', () => {
  const landmarks = makeLandmarks(0.1)
  const result = makeResult({
    landmarks: [landmarks],
    handedness: [[{ categoryName: 'Unknown', score: 0.9 }]]
  })

  const bucketed = bucketHandsByHandedness(result)

  assert.equal(bucketed.left, null)
  assert.equal(bucketed.right, null)
})

test('treats a non-finite score as zero so a finite-score candidate wins the slot', () => {
  const firstLandmarks = makeLandmarks(0.1)
  const secondLandmarks = makeLandmarks(0.2)
  const result = makeResult({
    landmarks: [firstLandmarks, secondLandmarks],
    handedness: [
      [{ categoryName: 'Right', score: Number.NaN }],
      [{ categoryName: 'Right', score: 0.8 }]
    ]
  })

  const bucketed = bucketHandsByHandedness(result)

  assert.equal(bucketed.right.index, 1)
  assert.equal(bucketed.right.landmarks, secondLandmarks)
  assert.equal(bucketed.left, null)
})

test('treats an Infinity score as invalid so a finite-score candidate wins the slot', () => {
  const firstLandmarks = makeLandmarks(0.1)
  const secondLandmarks = makeLandmarks(0.2)
  const result = makeResult({
    landmarks: [firstLandmarks, secondLandmarks],
    handedness: [
      [{ categoryName: 'Left', score: Number.POSITIVE_INFINITY }],
      [{ categoryName: 'Left', score: 0.8 }]
    ]
  })

  const bucketed = bucketHandsByHandedness(result)

  assert.equal(bucketed.left.index, 1)
  assert.equal(bucketed.left.landmarks, secondLandmarks)
  assert.equal(bucketed.right, null)
})

const HANDEDNESS_LEFT = 'Left'
const HANDEDNESS_RIGHT = 'Right'

export function bucketHandsByHandedness(result) {
  const empty = { left: null, right: null }

  if (!result) return empty
  if (!Array.isArray(result.landmarks)) return empty
  if (!Array.isArray(result.handedness)) return empty

  const buckets = { left: null, right: null }

  for (let i = 0; i < result.landmarks.length; i++) {
    const landmarks = result.landmarks[i]
    const label = readHandednessLabel(result.handedness[i])
    if (label === null) continue
    if (label !== HANDEDNESS_LEFT && label !== HANDEDNESS_RIGHT) continue

    const slot = label === HANDEDNESS_LEFT ? 'left' : 'right'
    const score = readHandednessScore(result.handedness[i])
    const candidate = { landmarks, index: i, score }
    const existing = buckets[slot]
    if (existing === null || candidate.score > existing.score) {
      buckets[slot] = candidate
    }
  }

  return {
    left: toSlotValue(buckets.left),
    right: toSlotValue(buckets.right)
  }
}

function readHandednessLabel(entry) {
  if (!Array.isArray(entry) || entry.length === 0) return null
  const first = entry[0]
  if (!first || typeof first.categoryName !== 'string') return null
  return first.categoryName
}

function readHandednessScore(entry) {
  if (!Array.isArray(entry) || entry.length === 0) return 0
  const first = entry[0]
  if (!first || typeof first.score !== 'number' || !Number.isFinite(first.score)) return 0
  return first.score
}

function toSlotValue(candidate) {
  if (candidate === null) return null
  return { landmarks: candidate.landmarks, index: candidate.index }
}

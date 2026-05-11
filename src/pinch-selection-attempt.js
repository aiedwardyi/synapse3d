export function createPinchSelectionAttempt() {
  let hasHitDuringPinch = false

  return {
    shouldAttempt(isPinching) {
      return isPinching && !hasHitDuringPinch
    },
    recordHit() {
      hasHitDuringPinch = true
    },
    reset() {
      hasHitDuringPinch = false
    }
  }
}

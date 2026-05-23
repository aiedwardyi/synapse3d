const ACTIVE_GESTURE_STATES = new Set(['select', 'drag', 'orbit', 'zoom'])

export function linkDirectionalParticlesForGestureState(gestureState, idleParticleCount) {
  return ACTIVE_GESTURE_STATES.has(gestureState) ? 0 : idleParticleCount
}

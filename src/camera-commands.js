const DEFAULT_ZOOM_FACTOR = 0.8
const DEFAULT_ORBIT_STEP = Math.PI / 12
const DEFAULT_MIN_RADIUS = 10
const DEFAULT_MAX_RADIUS = 2000
const PHI_CLAMP_MIN = 0.01
const PHI_CLAMP_MAX = Math.PI - 0.01
const STEP_TRANSITION_MS = 300
const RECENTER_TRANSITION_MS = 600

export function computeZoomedPosition(position, target, direction, {
  factor = DEFAULT_ZOOM_FACTOR,
  minRadius = DEFAULT_MIN_RADIUS,
  maxRadius = DEFAULT_MAX_RADIUS
} = {}) {
  const dx = position.x - target.x
  const dy = position.y - target.y
  const dz = position.z - target.z
  const radius = Math.hypot(dx, dy, dz)
  if (radius === 0) return { x: position.x, y: position.y, z: position.z }

  const ratio = direction === 'in' ? factor : 1 / factor
  const newRadius = clamp(radius * ratio, minRadius, maxRadius)
  const scale = newRadius / radius
  return {
    x: target.x + dx * scale,
    y: target.y + dy * scale,
    z: target.z + dz * scale
  }
}

export function computeOrbitedPosition(position, target, direction, {
  step = DEFAULT_ORBIT_STEP
} = {}) {
  const dx = position.x - target.x
  const dy = position.y - target.y
  const dz = position.z - target.z
  const radius = Math.hypot(dx, dy, dz)
  if (radius === 0) return { x: position.x, y: position.y, z: position.z }

  // THREE.Spherical convention: theta around +Y from +Z, phi from +Y axis.
  let theta = Math.atan2(dx, dz)
  let phi = Math.acos(clamp(dy / radius, -1, 1))

  if (direction === 'left') theta -= step
  else if (direction === 'right') theta += step
  else if (direction === 'up') phi -= step
  else if (direction === 'down') phi += step

  phi = clamp(phi, PHI_CLAMP_MIN, PHI_CLAMP_MAX)

  const sinPhi = Math.sin(phi)
  return {
    x: target.x + radius * sinPhi * Math.sin(theta),
    y: target.y + radius * Math.cos(phi),
    z: target.z + radius * sinPhi * Math.cos(theta)
  }
}

export function zoomStep(graph, direction) {
  if (!graph) return
  const position = graph.cameraPosition?.()
  const target = readControlsTarget(graph)
  if (!position || !target) return

  const next = computeZoomedPosition(position, target, direction)
  graph.cameraPosition(next, target, STEP_TRANSITION_MS)
}

export function orbitStep(graph, direction) {
  if (!graph) return
  const position = graph.cameraPosition?.()
  const target = readControlsTarget(graph)
  if (!position || !target) return

  const next = computeOrbitedPosition(position, target, direction)
  graph.cameraPosition(next, target, STEP_TRANSITION_MS)
}

export function recenter(graph) {
  if (!graph) return
  graph.zoomToFit?.(RECENTER_TRANSITION_MS)
}

function readControlsTarget(graph) {
  const controls = graph.controls?.()
  const target = controls?.target
  if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y) || !Number.isFinite(target.z)) {
    return null
  }
  return { x: target.x, y: target.y, z: target.z }
}

function clamp(value, min, max) {
  if (value < min) return min
  if (value > max) return max
  return value
}

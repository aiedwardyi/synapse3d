import * as THREE from 'three'

const DEFAULT_MIN_RADIUS = 10
const DEFAULT_MAX_RADIUS = 2000

export function createZoomController({
  minRadius = DEFAULT_MIN_RADIUS,
  maxRadius = DEFAULT_MAX_RADIUS
} = {}) {
  const offset = new THREE.Vector3()
  const direction = new THREE.Vector3()
  const zoomTarget = new THREE.Vector3()
  let anchorRadius = 0
  let anchorSpread = 0
  let active = false

  function beginZoom(spread, camera, lookAtTarget) {
    zoomTarget.copy(lookAtTarget)
    offset.subVectors(camera.position, zoomTarget)
    anchorRadius = offset.length()
    if (anchorRadius === 0) {
      direction.set(0, 0, 1)
    } else {
      direction.copy(offset).divideScalar(anchorRadius)
    }
    anchorSpread = spread
    active = true
  }

  function updateZoom(spread, camera) {
    if (!active) return
    if (anchorSpread === 0 || spread === 0) return

    const ratio = spread / anchorSpread
    const newRadius = clamp(anchorRadius / ratio, minRadius, maxRadius)
    offset.copy(direction).multiplyScalar(newRadius)
    camera.position.copy(zoomTarget).add(offset)
    camera.lookAt(zoomTarget)
  }

  function endZoom() {
    active = false
  }

  function isZooming() {
    return active
  }

  return { beginZoom, updateZoom, endZoom, isZooming }
}

function clamp(value, min, max) {
  if (value < min) return min
  if (value > max) return max
  return value
}

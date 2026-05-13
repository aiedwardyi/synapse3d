import * as THREE from 'three'

const PHI_CLAMP_MIN = 0.01
const PHI_CLAMP_MAX = Math.PI - 0.01

export function createOrbitController({
  azimuthScale = -2 * Math.PI,
  elevationScale = Math.PI
} = {}) {
  const offset = new THREE.Vector3()
  const spherical = new THREE.Spherical()
  const orbitTarget = new THREE.Vector3()
  const anchorPalm = { x: 0, y: 0 }
  let anchorRadius = 0
  let anchorPhi = 0
  let anchorTheta = 0
  let active = false

  function beginOrbit(palmAnchor, camera, lookAtTarget) {
    orbitTarget.copy(lookAtTarget)
    offset.subVectors(camera.position, orbitTarget)
    spherical.setFromVector3(offset)
    anchorRadius = spherical.radius
    anchorPhi = spherical.phi
    anchorTheta = spherical.theta
    anchorPalm.x = palmAnchor.x
    anchorPalm.y = palmAnchor.y
    active = true
  }

  function updateOrbit(palmPosition, camera) {
    if (!active) return

    const deltaX = palmPosition.x - anchorPalm.x
    const deltaY = palmPosition.y - anchorPalm.y

    const theta = anchorTheta + azimuthScale * deltaX
    const phi = clamp(anchorPhi + elevationScale * deltaY, PHI_CLAMP_MIN, PHI_CLAMP_MAX)

    spherical.set(anchorRadius, phi, theta)
    offset.setFromSpherical(spherical)
    camera.position.copy(orbitTarget).add(offset)
    camera.lookAt(orbitTarget)
  }

  function endOrbit() {
    active = false
  }

  function isOrbiting() {
    return active
  }

  return { beginOrbit, updateOrbit, endOrbit, isOrbiting }
}

function clamp(value, min, max) {
  if (value < min) return min
  if (value > max) return max
  return value
}

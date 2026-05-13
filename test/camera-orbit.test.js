import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { createOrbitController } from '../src/camera-orbit.js'

const PHI_CLAMP_MIN = 0.01
const PHI_CLAMP_MAX = Math.PI - 0.01

function createCameraAt(x, y, z) {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000)
  camera.position.set(x, y, z)
  camera.up.set(0, 1, 0)
  camera.updateMatrixWorld()
  return camera
}

function approx(actual, expected, epsilon = 1e-6) {
  return Math.abs(actual - expected) < epsilon
}

test('isOrbiting returns false on a fresh controller', () => {
  const orbit = createOrbitController()

  assert.equal(orbit.isOrbiting(), false)
})

test('isOrbiting returns true after beginOrbit and false after endOrbit', () => {
  const orbit = createOrbitController()
  const camera = createCameraAt(0, 0, 10)
  const target = new THREE.Vector3(0, 0, 0)

  orbit.beginOrbit({ x: 0.5, y: 0.5 }, camera, target)
  assert.equal(orbit.isOrbiting(), true)

  orbit.endOrbit()
  assert.equal(orbit.isOrbiting(), false)
})

test('updateOrbit before beginOrbit does nothing and does not throw', () => {
  const orbit = createOrbitController({ azimuthScale: 1, elevationScale: 1 })
  const camera = createCameraAt(0, 0, 10)
  const target = new THREE.Vector3(0, 0, 0)

  assert.doesNotThrow(() => {
    orbit.updateOrbit({ x: 0.7, y: 0.7 }, camera)
  })

  assert.ok(approx(camera.position.x, 0))
  assert.ok(approx(camera.position.y, 0))
  assert.ok(approx(camera.position.z, 10))
})

test('endOrbit before beginOrbit does nothing and does not throw', () => {
  const orbit = createOrbitController()

  assert.doesNotThrow(() => orbit.endOrbit())
  assert.equal(orbit.isOrbiting(), false)
})

test('updateOrbit with zero delta leaves camera position unchanged', () => {
  const orbit = createOrbitController({ azimuthScale: 1, elevationScale: 1 })
  const camera = createCameraAt(3, 4, 12)
  const target = new THREE.Vector3(0, 0, 0)

  orbit.beginOrbit({ x: 0.5, y: 0.5 }, camera, target)
  orbit.updateOrbit({ x: 0.5, y: 0.5 }, camera)

  assert.ok(approx(camera.position.x, 3), `x=${camera.position.x}`)
  assert.ok(approx(camera.position.y, 4), `y=${camera.position.y}`)
  assert.ok(approx(camera.position.z, 12), `z=${camera.position.z}`)
})

test('beginOrbit captures camera spherical coords as the orbit anchor', () => {
  const orbit = createOrbitController({ azimuthScale: 1, elevationScale: 1 })
  const camera = createCameraAt(0, 0, 10)
  const target = new THREE.Vector3(0, 0, 0)

  orbit.beginOrbit({ x: 0.5, y: 0.5 }, camera, target)

  camera.position.set(99, 99, 99)
  orbit.updateOrbit({ x: 0.5, y: 0.5 }, camera)

  assert.ok(approx(camera.position.x, 0), `x=${camera.position.x}`)
  assert.ok(approx(camera.position.y, 0), `y=${camera.position.y}`)
  assert.ok(approx(camera.position.z, 10), `z=${camera.position.z}`)
})

test('updateOrbit with positive x delta changes theta by azimuthScale * delta', () => {
  const orbit = createOrbitController({ azimuthScale: 1, elevationScale: 1 })
  const camera = createCameraAt(0, 0, 10)
  const target = new THREE.Vector3(0, 0, 0)

  orbit.beginOrbit({ x: 0.5, y: 0.5 }, camera, target)
  orbit.updateOrbit({ x: 0.6, y: 0.5 }, camera)

  const expectedTheta = 0.1
  const expectedX = 10 * Math.sin(expectedTheta)
  const expectedZ = 10 * Math.cos(expectedTheta)

  assert.ok(approx(camera.position.x, expectedX), `x=${camera.position.x}, expected ${expectedX}`)
  assert.ok(approx(camera.position.y, 0), `y=${camera.position.y}`)
  assert.ok(approx(camera.position.z, expectedZ), `z=${camera.position.z}, expected ${expectedZ}`)
})

test('updateOrbit with positive y delta changes phi by elevationScale * delta', () => {
  const orbit = createOrbitController({ azimuthScale: 1, elevationScale: 1 })
  const camera = createCameraAt(0, 0, 10)
  const target = new THREE.Vector3(0, 0, 0)

  orbit.beginOrbit({ x: 0.5, y: 0.5 }, camera, target)
  orbit.updateOrbit({ x: 0.5, y: 0.6 }, camera)

  const expectedPhi = Math.PI / 2 + 0.1
  const expectedY = 10 * Math.cos(expectedPhi)
  const expectedZ = 10 * Math.sin(expectedPhi)

  assert.ok(approx(camera.position.x, 0), `x=${camera.position.x}`)
  assert.ok(approx(camera.position.y, expectedY), `y=${camera.position.y}, expected ${expectedY}`)
  assert.ok(approx(camera.position.z, expectedZ), `z=${camera.position.z}, expected ${expectedZ}`)
})

test('updateOrbit clamps phi just below pi to prevent gimbal flip on large positive y delta', () => {
  const orbit = createOrbitController({ azimuthScale: 1, elevationScale: 1 })
  const camera = createCameraAt(0, 0, 10)
  const target = new THREE.Vector3(0, 0, 0)

  orbit.beginOrbit({ x: 0.5, y: 0.5 }, camera, target)
  orbit.updateOrbit({ x: 0.5, y: 100 }, camera)

  const expectedY = 10 * Math.cos(PHI_CLAMP_MAX)
  assert.ok(approx(camera.position.y, expectedY), `y=${camera.position.y}, expected ${expectedY}`)
})

test('updateOrbit clamps phi just above zero to prevent gimbal flip on large negative y delta', () => {
  const orbit = createOrbitController({ azimuthScale: 1, elevationScale: 1 })
  const camera = createCameraAt(0, 0, 10)
  const target = new THREE.Vector3(0, 0, 0)

  orbit.beginOrbit({ x: 0.5, y: 0.5 }, camera, target)
  orbit.updateOrbit({ x: 0.5, y: -100 }, camera)

  const expectedY = 10 * Math.cos(PHI_CLAMP_MIN)
  assert.ok(approx(camera.position.y, expectedY), `y=${camera.position.y}, expected ${expectedY}`)
})

test('updateOrbit preserves the camera-to-target radius across rotation', () => {
  const orbit = createOrbitController({ azimuthScale: 1, elevationScale: 0.5 })
  const camera = createCameraAt(0, 0, 10)
  const target = new THREE.Vector3(0, 0, 0)

  orbit.beginOrbit({ x: 0.5, y: 0.5 }, camera, target)
  orbit.updateOrbit({ x: 0.7, y: 0.3 }, camera)

  assert.ok(approx(camera.position.length(), 10), `radius=${camera.position.length()}`)
})

test('updateOrbit preserves the camera-to-target radius when target is offset from origin', () => {
  const orbit = createOrbitController({ azimuthScale: 1, elevationScale: 1 })
  const camera = createCameraAt(5, 5, 15)
  const target = new THREE.Vector3(5, 5, 5)
  const initialRadius = camera.position.distanceTo(target)

  orbit.beginOrbit({ x: 0.5, y: 0.5 }, camera, target)
  orbit.updateOrbit({ x: 0.6, y: 0.4 }, camera)

  assert.ok(approx(camera.position.distanceTo(target), initialRadius), `radius=${camera.position.distanceTo(target)}`)
})

test('updateOrbit orients the camera to look at the target', () => {
  const orbit = createOrbitController({ azimuthScale: 1, elevationScale: 1 })
  const camera = createCameraAt(0, 0, 10)
  const target = new THREE.Vector3(0, 0, 0)

  orbit.beginOrbit({ x: 0.5, y: 0.5 }, camera, target)
  orbit.updateOrbit({ x: 0.6, y: 0.55 }, camera)
  camera.updateMatrixWorld()

  const forward = new THREE.Vector3()
  camera.getWorldDirection(forward)
  const expected = new THREE.Vector3().subVectors(target, camera.position).normalize()

  assert.ok(approx(forward.x, expected.x), `forward.x=${forward.x}, expected ${expected.x}`)
  assert.ok(approx(forward.y, expected.y), `forward.y=${forward.y}, expected ${expected.y}`)
  assert.ok(approx(forward.z, expected.z), `forward.z=${forward.z}, expected ${expected.z}`)
})

test('beginOrbit copies the lookAtTarget so later mutations do not perturb orbit math', () => {
  const orbit = createOrbitController({ azimuthScale: 1, elevationScale: 1 })
  const camera = createCameraAt(0, 0, 10)
  const target = new THREE.Vector3(0, 0, 0)

  orbit.beginOrbit({ x: 0.5, y: 0.5 }, camera, target)
  target.set(50, 50, 50)
  orbit.updateOrbit({ x: 0.5, y: 0.5 }, camera)

  assert.ok(approx(camera.position.x, 0), `x=${camera.position.x}`)
  assert.ok(approx(camera.position.y, 0), `y=${camera.position.y}`)
  assert.ok(approx(camera.position.z, 10), `z=${camera.position.z}`)
})

test('endOrbit clears state so a subsequent beginOrbit re-anchors', () => {
  const orbit = createOrbitController({ azimuthScale: 1, elevationScale: 1 })
  const camera = createCameraAt(0, 0, 10)
  const target = new THREE.Vector3(0, 0, 0)

  orbit.beginOrbit({ x: 0.5, y: 0.5 }, camera, target)
  orbit.updateOrbit({ x: 0.7, y: 0.5 }, camera)
  orbit.endOrbit()

  const positionAtSecondBegin = camera.position.clone()
  orbit.beginOrbit({ x: 0.3, y: 0.3 }, camera, target)
  orbit.updateOrbit({ x: 0.3, y: 0.3 }, camera)

  assert.ok(approx(camera.position.x, positionAtSecondBegin.x), `x=${camera.position.x}, expected ${positionAtSecondBegin.x}`)
  assert.ok(approx(camera.position.y, positionAtSecondBegin.y), `y=${camera.position.y}, expected ${positionAtSecondBegin.y}`)
  assert.ok(approx(camera.position.z, positionAtSecondBegin.z), `z=${camera.position.z}, expected ${positionAtSecondBegin.z}`)
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { createZoomController } from '../src/camera-zoom.js'

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

test('isZooming returns false on a fresh controller', () => {
  const zoom = createZoomController()

  assert.equal(zoom.isZooming(), false)
})

test('isZooming returns true after beginZoom and false after endZoom', () => {
  const zoom = createZoomController()
  const camera = createCameraAt(0, 0, 10)
  const target = new THREE.Vector3(0, 0, 0)

  zoom.beginZoom(0.4, camera, target)
  assert.equal(zoom.isZooming(), true)

  zoom.endZoom()
  assert.equal(zoom.isZooming(), false)
})

test('updateZoom before beginZoom does nothing and does not throw', () => {
  const zoom = createZoomController()
  const camera = createCameraAt(0, 0, 10)

  assert.doesNotThrow(() => zoom.updateZoom(0.5, camera))

  assert.ok(approx(camera.position.x, 0))
  assert.ok(approx(camera.position.y, 0))
  assert.ok(approx(camera.position.z, 10))
})

test('endZoom before beginZoom does nothing and does not throw', () => {
  const zoom = createZoomController()

  assert.doesNotThrow(() => zoom.endZoom())
  assert.equal(zoom.isZooming(), false)
})

test('updateZoom with spread equal to anchor leaves camera position unchanged', () => {
  const zoom = createZoomController()
  const camera = createCameraAt(3, 4, 12)
  const target = new THREE.Vector3(0, 0, 0)

  zoom.beginZoom(0.4, camera, target)
  zoom.updateZoom(0.4, camera)

  assert.ok(approx(camera.position.x, 3), `x=${camera.position.x}`)
  assert.ok(approx(camera.position.y, 4), `y=${camera.position.y}`)
  assert.ok(approx(camera.position.z, 12), `z=${camera.position.z}`)
})

test('beginZoom captures camera radius so later position mutations do not affect updateZoom math', () => {
  const zoom = createZoomController()
  const camera = createCameraAt(0, 0, 100)
  const target = new THREE.Vector3(0, 0, 0)

  zoom.beginZoom(0.4, camera, target)
  camera.position.set(99, 99, 99)
  zoom.updateZoom(0.4, camera)

  assert.ok(approx(camera.position.x, 0), `x=${camera.position.x}`)
  assert.ok(approx(camera.position.y, 0), `y=${camera.position.y}`)
  assert.ok(approx(camera.position.z, 100), `z=${camera.position.z}`)
})

test('updateZoom with spread doubled halves the camera radius', () => {
  const zoom = createZoomController()
  const camera = createCameraAt(0, 0, 100)
  const target = new THREE.Vector3(0, 0, 0)

  zoom.beginZoom(0.4, camera, target)
  zoom.updateZoom(0.8, camera)

  assert.ok(approx(camera.position.x, 0))
  assert.ok(approx(camera.position.y, 0))
  assert.ok(approx(camera.position.z, 50), `z=${camera.position.z}`)
})

test('updateZoom with spread halved doubles the camera radius', () => {
  const zoom = createZoomController()
  const camera = createCameraAt(0, 0, 100)
  const target = new THREE.Vector3(0, 0, 0)

  zoom.beginZoom(0.4, camera, target)
  zoom.updateZoom(0.2, camera)

  assert.ok(approx(camera.position.z, 200), `z=${camera.position.z}`)
})

test('updateZoom preserves the view direction across radius changes', () => {
  const zoom = createZoomController()
  const camera = createCameraAt(3, 4, 12)
  const target = new THREE.Vector3(0, 0, 0)
  const initialOffset = camera.position.clone().sub(target)
  const initialDirection = initialOffset.clone().normalize()

  zoom.beginZoom(0.5, camera, target)
  zoom.updateZoom(1.0, camera)

  const newOffset = camera.position.clone().sub(target)
  const newDirection = newOffset.clone().normalize()

  assert.ok(approx(newDirection.x, initialDirection.x), `dirX=${newDirection.x}`)
  assert.ok(approx(newDirection.y, initialDirection.y), `dirY=${newDirection.y}`)
  assert.ok(approx(newDirection.z, initialDirection.z), `dirZ=${newDirection.z}`)
})

test('updateZoom preserves the view direction when target is offset from origin', () => {
  const zoom = createZoomController({ minRadius: 1, maxRadius: 5000 })
  const camera = createCameraAt(15, 15, 15)
  const target = new THREE.Vector3(5, 5, 5)
  const initialOffset = camera.position.clone().sub(target)
  const initialDirection = initialOffset.clone().normalize()
  const initialRadius = initialOffset.length()

  zoom.beginZoom(0.4, camera, target)
  zoom.updateZoom(0.8, camera)

  const newOffset = camera.position.clone().sub(target)
  const newDirection = newOffset.clone().normalize()
  const newRadius = newOffset.length()

  assert.ok(approx(newDirection.x, initialDirection.x), `dirX=${newDirection.x}`)
  assert.ok(approx(newDirection.y, initialDirection.y), `dirY=${newDirection.y}`)
  assert.ok(approx(newDirection.z, initialDirection.z), `dirZ=${newDirection.z}`)
  assert.ok(approx(newRadius, initialRadius / 2), `radius=${newRadius}`)
})

test('updateZoom clamps to minRadius when the ratio would push below it', () => {
  const zoom = createZoomController({ minRadius: 5, maxRadius: 1000 })
  const camera = createCameraAt(0, 0, 100)
  const target = new THREE.Vector3(0, 0, 0)

  zoom.beginZoom(0.4, camera, target)
  zoom.updateZoom(40, camera)

  assert.ok(approx(camera.position.z, 5), `z=${camera.position.z}`)
})

test('updateZoom clamps to maxRadius when the ratio would push above it', () => {
  const zoom = createZoomController({ minRadius: 5, maxRadius: 500 })
  const camera = createCameraAt(0, 0, 100)
  const target = new THREE.Vector3(0, 0, 0)

  zoom.beginZoom(0.4, camera, target)
  zoom.updateZoom(0.001, camera)

  assert.ok(approx(camera.position.z, 500), `z=${camera.position.z}`)
})

test('updateZoom is a no-op when anchorSpread is zero', () => {
  const zoom = createZoomController()
  const camera = createCameraAt(0, 0, 10)
  const target = new THREE.Vector3(0, 0, 0)

  zoom.beginZoom(0, camera, target)
  zoom.updateZoom(0.5, camera)

  assert.ok(approx(camera.position.z, 10), `z=${camera.position.z}`)
  assert.ok(Number.isFinite(camera.position.x))
  assert.ok(Number.isFinite(camera.position.y))
  assert.ok(Number.isFinite(camera.position.z))
})

test('updateZoom is a no-op when spread is zero', () => {
  const zoom = createZoomController()
  const camera = createCameraAt(0, 0, 10)
  const target = new THREE.Vector3(0, 0, 0)

  zoom.beginZoom(0.4, camera, target)
  zoom.updateZoom(0, camera)

  assert.ok(approx(camera.position.z, 10), `z=${camera.position.z}`)
  assert.ok(Number.isFinite(camera.position.x))
  assert.ok(Number.isFinite(camera.position.y))
  assert.ok(Number.isFinite(camera.position.z))
})

test('endZoom clears state so a subsequent beginZoom re-anchors to the new position', () => {
  const zoom = createZoomController()
  const camera = createCameraAt(0, 0, 100)
  const target = new THREE.Vector3(0, 0, 0)

  zoom.beginZoom(0.4, camera, target)
  zoom.updateZoom(0.8, camera)
  zoom.endZoom()

  zoom.beginZoom(0.5, camera, target)
  zoom.updateZoom(1.0, camera)

  assert.ok(approx(camera.position.z, 25), `z=${camera.position.z}`)
})

test('updateZoom orients the camera to look at the target', () => {
  const zoom = createZoomController()
  const camera = createCameraAt(0, 0, 100)
  const target = new THREE.Vector3(0, 0, 0)

  zoom.beginZoom(0.4, camera, target)
  zoom.updateZoom(0.5, camera)
  camera.updateMatrixWorld()

  const forward = new THREE.Vector3()
  camera.getWorldDirection(forward)
  const expected = new THREE.Vector3().subVectors(target, camera.position).normalize()

  assert.ok(approx(forward.x, expected.x), `forward.x=${forward.x}`)
  assert.ok(approx(forward.y, expected.y), `forward.y=${forward.y}`)
  assert.ok(approx(forward.z, expected.z), `forward.z=${forward.z}`)
})

test('beginZoom copies the lookAtTarget so later mutations do not perturb zoom math', () => {
  const zoom = createZoomController()
  const camera = createCameraAt(0, 0, 100)
  const target = new THREE.Vector3(0, 0, 0)

  zoom.beginZoom(0.4, camera, target)
  target.set(99, 99, 99)
  zoom.updateZoom(0.8, camera)

  assert.ok(approx(camera.position.x, 0), `x=${camera.position.x}`)
  assert.ok(approx(camera.position.y, 0), `y=${camera.position.y}`)
  assert.ok(approx(camera.position.z, 50), `z=${camera.position.z}`)
})

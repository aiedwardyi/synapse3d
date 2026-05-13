import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { createDragController } from '../src/drag.js'

function createCamera() {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000)
  camera.updateMatrixWorld()
  return camera
}

function createHit(node, position) {
  const mesh = new THREE.Object3D()
  mesh.position.copy(position)
  mesh.updateMatrixWorld()

  return {
    nodeId: node.id,
    node,
    mesh
  }
}

test('isDragging returns false on a fresh controller', () => {
  const drag = createDragController()

  assert.equal(drag.isDragging(), false)
  assert.equal(drag.getTargetNode(), null)
})

test('beginDrag stores the target node and reports dragging', () => {
  const drag = createDragController()
  const camera = createCamera()
  const node = { id: 'n1' }
  const hit = createHit(node, new THREE.Vector3(0, 0, -10))

  drag.beginDrag(hit, camera)

  assert.equal(drag.isDragging(), true)
  assert.strictEqual(drag.getTargetNode(), node)
})

test('endDrag clears the target without resetting fx/fy/fz', () => {
  const drag = createDragController()
  const camera = createCamera()
  const raycaster = new THREE.Raycaster()
  const node = { id: 'n1' }
  const hit = createHit(node, new THREE.Vector3(0, 0, -10))

  drag.beginDrag(hit, camera)
  drag.updateDrag({ x: 0.5, y: 0.5 }, camera, raycaster)

  const pinnedX = node.fx
  const pinnedY = node.fy
  const pinnedZ = node.fz

  drag.endDrag()

  assert.equal(drag.isDragging(), false)
  assert.equal(drag.getTargetNode(), null)
  assert.equal(node.fx, pinnedX)
  assert.equal(node.fy, pinnedY)
  assert.equal(node.fz, pinnedZ)
})

test('updateDrag before beginDrag does nothing and does not throw', () => {
  const drag = createDragController()
  const camera = createCamera()
  const raycaster = new THREE.Raycaster()

  assert.doesNotThrow(() => {
    drag.updateDrag({ x: 0.5, y: 0.5 }, camera, raycaster)
  })

  assert.equal(drag.isDragging(), false)
  assert.equal(drag.getTargetNode(), null)
})

test('endDrag before beginDrag does nothing and does not throw', () => {
  const drag = createDragController()

  assert.doesNotThrow(() => drag.endDrag())
  assert.equal(drag.isDragging(), false)
  assert.equal(drag.getTargetNode(), null)
})

test('updateDrag at viewport center pins the node at its starting depth', () => {
  const drag = createDragController()
  const camera = createCamera()
  const raycaster = new THREE.Raycaster()
  const node = { id: 'n1', fx: undefined, fy: undefined, fz: undefined }
  const hit = createHit(node, new THREE.Vector3(0, 0, -10))

  drag.beginDrag(hit, camera)
  drag.updateDrag({ x: 0.5, y: 0.5 }, camera, raycaster)

  const epsilon = 1e-4
  assert.ok(Math.abs(node.fx - 0) < epsilon, `fx=${node.fx} should be ~0`)
  assert.ok(Math.abs(node.fy - 0) < epsilon, `fy=${node.fy} should be ~0`)
  assert.ok(Math.abs(node.fz - (-10)) < epsilon, `fz=${node.fz} should be ~-10`)
})

test('updateDrag right of center moves node positive x but holds depth', () => {
  const drag = createDragController()
  const camera = createCamera()
  const raycaster = new THREE.Raycaster()
  const node = { id: 'n1', fx: undefined, fy: undefined, fz: undefined }
  const hit = createHit(node, new THREE.Vector3(0, 0, -10))

  drag.beginDrag(hit, camera)
  drag.updateDrag({ x: 0.75, y: 0.5 }, camera, raycaster)

  const epsilon = 1e-4
  assert.ok(node.fx > 0, `fx=${node.fx} should be > 0`)
  assert.ok(Math.abs(node.fy - 0) < epsilon, `fy=${node.fy} should be ~0`)
  assert.ok(Math.abs(node.fz - (-10)) < epsilon, `fz=${node.fz} should be ~-10`)
})

test('beginDrag anchors the drag plane at the mesh world position when a parent is transformed', () => {
  const drag = createDragController()
  const camera = createCamera()
  const raycaster = new THREE.Raycaster()
  const node = { id: 'n1', fx: undefined, fy: undefined, fz: undefined }

  const parent = new THREE.Object3D()
  parent.position.set(0, 0, -10)
  const mesh = new THREE.Object3D()
  mesh.position.set(0, 0, -5)
  parent.add(mesh)
  parent.updateMatrixWorld(true)

  drag.beginDrag({ nodeId: node.id, node, mesh }, camera)
  drag.updateDrag({ x: 0.5, y: 0.5 }, camera, raycaster)

  const epsilon = 1e-4
  assert.ok(Math.abs(node.fz - (-15)) < epsilon, `fz=${node.fz} should be ~-15 (parent -10 + child -5)`)
})

test('beginDrag on a second node switches the drag target', () => {
  const drag = createDragController()
  const camera = createCamera()
  const raycaster = new THREE.Raycaster()
  const firstNode = { id: 'a' }
  const secondNode = { id: 'b' }
  const firstHit = createHit(firstNode, new THREE.Vector3(0, 0, -10))
  const secondHit = createHit(secondNode, new THREE.Vector3(0, 0, -20))

  drag.beginDrag(firstHit, camera)
  drag.updateDrag({ x: 0.5, y: 0.5 }, camera, raycaster)
  drag.beginDrag(secondHit, camera)
  drag.updateDrag({ x: 0.5, y: 0.5 }, camera, raycaster)

  assert.strictEqual(drag.getTargetNode(), secondNode)
  const epsilon = 1e-4
  assert.ok(Math.abs(secondNode.fz - (-20)) < epsilon, `secondNode.fz=${secondNode.fz} should be ~-20`)
  assert.ok(Math.abs(firstNode.fz - (-10)) < epsilon, `firstNode.fz=${firstNode.fz} should remain ~-10`)
})

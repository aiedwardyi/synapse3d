import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { findNodeAtScreenPoint } from '../src/gesture-raycasting.js'
import {
  createNodeMesh,
  NODE_PICK_RADIUS,
  NODE_PICK_SEGMENTS,
  NODE_VISIBLE_RADIUS,
  setNodeMeshScale,
  updateNodeMesh
} from '../src/node-mesh.js'

test('createNodeMesh tags the visible mesh with node metadata', () => {
  const node = { id: 'alpha', label: 'Alpha', tags: ['core'] }
  const materialTracker = createMaterialTrackerStub()
  const mesh = createNodeMesh(node, {
    color: '#4a90e2',
    materialTracker
  })

  assert.equal(mesh.userData.isNode, true)
  assert.equal(mesh.userData.nodeId, node.id)
  assert.equal(mesh.userData.node, node)
  assert.equal(mesh.geometry.parameters.radius, NODE_VISIBLE_RADIUS)
  assert.equal(materialTracker.materials.length, 1)
  assert.equal(materialTracker.materials[0], mesh.material)
})

test('createNodeMesh adds a larger invisible child pick target', () => {
  const mesh = createNodeMesh({ id: 'alpha' }, {
    color: '#4a90e2',
    materialTracker: createMaterialTrackerStub()
  })
  const pickTarget = mesh.children.find(child => child.userData?.isNodePickTarget)

  assert.ok(pickTarget)
  assert.equal(pickTarget.userData.isNode, undefined)
  assert.equal(pickTarget.geometry.parameters.radius, NODE_PICK_RADIUS)
  assert.ok(NODE_PICK_RADIUS > NODE_VISIBLE_RADIUS)
  assert.equal(pickTarget.material.transparent, true)
  assert.equal(pickTarget.material.opacity, 0)
  assert.equal(pickTarget.material.depthWrite, false)
  assert.equal(pickTarget.material.colorWrite, false)
  assert.equal(pickTarget.material.side, THREE.DoubleSide)
  assert.equal(pickTarget.geometry.parameters.widthSegments, NODE_PICK_SEGMENTS)
  assert.equal(pickTarget.geometry.parameters.heightSegments, NODE_PICK_SEGMENTS)
})

test('setNodeMeshScale keeps pick target world scale stable', () => {
  const mesh = createNodeMesh({ id: 'alpha' }, {
    color: '#4a90e2',
    materialTracker: createMaterialTrackerStub()
  })
  const pickTarget = mesh.children.find(child => child.userData?.isNodePickTarget)

  setNodeMeshScale(mesh, 1.5)

  assert.equal(mesh.scale.x, 1.5)
  assertApprox(pickTarget.scale.x, 1 / 1.5)
  assertApprox(mesh.scale.x * pickTarget.scale.x, 1)
})

test('updateNodeMesh refreshes reused mesh metadata and color', () => {
  const firstNode = { id: 'alpha', label: 'Old', tags: ['old'] }
  const nextNode = { id: 'alpha', label: 'New', tags: ['new'] }
  const mesh = createNodeMesh(firstNode, {
    color: '#4a90e2',
    materialTracker: createMaterialTrackerStub()
  })

  mesh.userData.originalColor = mesh.material.color.getHex()
  setNodeMeshScale(mesh, 1.5)

  updateNodeMesh(mesh, nextNode, '#e24a90')

  assert.equal(mesh.userData.isNode, true)
  assert.equal(mesh.userData.nodeId, nextNode.id)
  assert.equal(mesh.userData.node, nextNode)
  assert.equal(mesh.userData.originalColor, undefined)
  assert.equal(mesh.material.color.getHex(), 0xe24a90)
  assert.equal(mesh.scale.x, 1)
})

test('larger pick target selects the visible node when the visible sphere is missed', () => {
  const node = { id: 'alpha', label: 'Alpha' }
  const mesh = createNodeMesh(node, {
    color: '#4a90e2',
    materialTracker: createMaterialTrackerStub()
  })
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000)

  camera.position.z = 30
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
  scene.add(mesh)
  scene.updateMatrixWorld(true)

  const hit = findNodeAtScreenPoint(
    { x: 0.75, y: 0.5 },
    camera,
    scene,
    new THREE.Raycaster()
  )

  assert.equal(hit?.nodeId, node.id)
  assert.equal(hit?.node, node)
  assert.equal(hit?.mesh, mesh)
})

function createMaterialTrackerStub() {
  return {
    materials: [],
    track(material) {
      this.materials.push(material)
      return material
    }
  }
}

function assertApprox(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-12, `expected ${actual} to be close to ${expected}`)
}

import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { findNodeAtScreenPoint } from '../src/gesture-raycasting.js'
import {
  createNodeMesh,
  NODE_PICK_RADIUS,
  NODE_VISIBLE_RADIUS
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

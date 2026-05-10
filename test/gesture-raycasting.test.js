import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  findNodeAtScreenPoint,
  screenPointToNdc
} from '../src/gesture-raycasting.js'

test('screenPointToNdc maps viewport center to NDC center', () => {
  assert.deepEqual(screenPointToNdc({ x: 0.5, y: 0.5 }), { x: 0, y: 0 })
})

test('screenPointToNdc maps viewport top-left to NDC top-left', () => {
  assert.deepEqual(screenPointToNdc({ x: 0, y: 0 }), { x: -1, y: 1 })
})

test('screenPointToNdc maps viewport bottom-right to NDC bottom-right', () => {
  assert.deepEqual(screenPointToNdc({ x: 1, y: 1 }), { x: 1, y: -1 })
})

test('findNodeAtScreenPoint returns null when the ray hits nothing', () => {
  const raycaster = createRaycaster([])
  const scene = { children: [] }
  const camera = {}

  const result = findNodeAtScreenPoint({ x: 0.5, y: 0.5 }, camera, scene, raycaster)

  assert.equal(result, null)
  assert.deepEqual(raycaster.setFromCameraCalls, [[{ x: 0, y: 0 }, camera]])
  assert.deepEqual(raycaster.intersectObjectsCalls, [[scene.children, true]])
})

test('findNodeAtScreenPoint returns the first node-tagged hit', () => {
  const firstNode = createNodeMesh('first')
  const secondNode = createNodeMesh('second')
  const raycaster = createRaycaster([
    { object: { userData: {} } },
    { object: firstNode },
    { object: secondNode }
  ])

  const result = findNodeAtScreenPoint(
    { x: 0.25, y: 0.75 },
    {},
    { children: ['child'] },
    raycaster
  )

  assert.deepEqual(result, {
    nodeId: 'first',
    node: firstNode.userData.node,
    mesh: firstNode
  })
})

test('findNodeAtScreenPoint walks parent chain to find node tag', () => {
  const parentNode = createNodeMesh('parent')
  const childMesh = {
    userData: {},
    parent: parentNode
  }
  const raycaster = createRaycaster([{ object: childMesh }])

  const result = findNodeAtScreenPoint(
    { x: 0.5, y: 0.5 },
    {},
    { children: [] },
    raycaster
  )

  assert.deepEqual(result, {
    nodeId: 'parent',
    node: parentNode.userData.node,
    mesh: parentNode
  })
})

test('findNodeAtScreenPoint returns null when no hit has a node tag', () => {
  const nestedHit = {
    userData: {},
    parent: {
      userData: {},
      parent: null
    }
  }
  const raycaster = createRaycaster([{ object: nestedHit }])

  const result = findNodeAtScreenPoint(
    { x: 0.5, y: 0.5 },
    {},
    { children: [] },
    raycaster
  )

  assert.equal(result, null)
})

function createNodeMesh(id) {
  const node = {
    id,
    label: id,
    tags: []
  }

  return {
    userData: {
      isNode: true,
      nodeId: id,
      node
    },
    parent: null
  }
}

function createRaycaster(intersections) {
  return {
    setFromCameraCalls: [],
    intersectObjectsCalls: [],
    setFromCamera(ndc, camera) {
      this.setFromCameraCalls.push([ndc, camera])
    },
    intersectObjects(children, recursive) {
      this.intersectObjectsCalls.push([children, recursive])
      return intersections
    }
  }
}

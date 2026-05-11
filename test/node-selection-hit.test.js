import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createNodeSelectionHit } from '../src/node-selection-hit.js'

test('createNodeSelectionHit returns null when node has no registered mesh', () => {
  const node = { id: 'alpha' }
  const meshes = new Map()

  assert.equal(createNodeSelectionHit(node, meshes), null)
})

test('createNodeSelectionHit returns a selection hit for a registered node mesh', () => {
  const node = { id: 'alpha', label: 'Alpha' }
  const mesh = { userData: {} }
  const meshes = new Map([[node.id, mesh]])

  assert.deepEqual(createNodeSelectionHit(node, meshes), {
    nodeId: node.id,
    node,
    mesh
  })
})

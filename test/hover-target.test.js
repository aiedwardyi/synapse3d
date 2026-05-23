import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveHoverTarget } from '../src/hover-target.js'

test('resolveHoverTarget returns null without a hit', () => {
  assert.equal(resolveHoverTarget(null), null)
})

test('resolveHoverTarget returns the hit when it is not selected or dragged', () => {
  const hit = createHit('a')

  assert.strictEqual(resolveHoverTarget(hit, {
    selectedNodeId: 'b',
    draggedNodeId: 'c'
  }), hit)
})

test('resolveHoverTarget suppresses the selected node', () => {
  const hit = createHit('a')

  assert.equal(resolveHoverTarget(hit, { selectedNodeId: 'a' }), null)
})

test('resolveHoverTarget suppresses the dragged node', () => {
  const hit = createHit('a')

  assert.equal(resolveHoverTarget(hit, { draggedNodeId: 'a' }), null)
})

function createHit(id) {
  return {
    nodeId: id,
    node: { id },
    mesh: {}
  }
}

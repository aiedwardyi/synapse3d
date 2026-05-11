export function createNodeSelectionHit(node, nodeMeshes) {
  const mesh = nodeMeshes.get(node.id)
  if (!mesh) return null

  return {
    nodeId: node.id,
    node,
    mesh
  }
}

export function selectionWouldChange(currentSelection, hit) {
  return Boolean(hit && currentSelection?.mesh !== hit.mesh)
}

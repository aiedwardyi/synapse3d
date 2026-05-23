export function resolveHoverTarget(hit, {
  selectedNodeId = null,
  draggedNodeId = null
} = {}) {
  const nodeId = hoverNodeId(hit)
  if (nodeId === null) return null
  if (nodeId === selectedNodeId || nodeId === draggedNodeId) return null

  return hit
}

function hoverNodeId(hit) {
  const nodeId = hit?.nodeId ?? hit?.node?.id
  return nodeId === undefined || nodeId === null ? null : nodeId
}

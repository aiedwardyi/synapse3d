export function resolveHoverTarget(hit, {
  selectedNodeId = null,
  draggedNodeId = null
} = {}) {
  const nodeId = hoverNodeId(hit)
  if (nodeId === null) return null
  if (nodeId === selectedNodeId || nodeId === draggedNodeId) return null

  return hit
}

export function hoverNodeLabel(hit) {
  return nonEmptyString(hit?.node?.label)
    ?? nonEmptyString(hit?.node?.name)
    ?? hit?.node?.id
    ?? hit?.nodeId
}

function hoverNodeId(hit) {
  const nodeId = hit?.nodeId ?? hit?.node?.id
  return nodeId === undefined || nodeId === null ? null : nodeId
}

function nonEmptyString(value) {
  if (typeof value !== 'string') return null
  return value.trim() ? value : null
}

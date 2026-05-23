import * as THREE from 'three'

const linkStartVector = new THREE.Vector3()
const linkEndVector = new THREE.Vector3()
const linkLookAtVector = new THREE.Vector3()
const localStartVector = new THREE.Vector3()

export function linkEndpointId(endpoint) {
  if (endpoint && typeof endpoint === 'object') return endpoint.id
  return endpoint
}

export function createIncidentLinkMap(links = []) {
  const incidentLinkMap = new Map()

  for (const link of links) {
    const sourceId = linkEndpointId(link.source)
    const targetId = linkEndpointId(link.target)

    addIncidentLink(incidentLinkMap, sourceId, link)
    if (targetId !== sourceId) addIncidentLink(incidentLinkMap, targetId, link)
  }

  return incidentLinkMap
}

export function syncIncidentLinkPositions(node, incidentLinkMap, fallbackLinks, syncLinkPosition) {
  if (!node?.id || typeof syncLinkPosition !== 'function') return

  const links = incidentLinkMap?.get?.(node.id) || collectIncidentLinks(node.id, fallbackLinks)
  for (const link of links) {
    syncLinkPosition(link)
  }
}

export function syncLinkPosition(link, getNode) {
  // 3d-force-graph 1.80 stores rendered link objects on link.__lineObj.
  const lineObj = link?.__lineObj
  if (!lineObj) return false

  const start = linkEndpointPosition(link.source, getNode)
  const end = linkEndpointPosition(link.target, getNode)
  if (!start || !end) return false

  const line = lineObj.children?.length ? lineObj.children[0] : lineObj
  if (line?.type === 'Line') return updateLineGeometry(line, start, end)
  if (line?.type === 'Mesh') return updateCylinderLink(line, start, end)

  return false
}

export function updateLineGeometry(line, start, end) {
  const position = line.geometry?.getAttribute?.('position')
  if (!position || position.count < 2) return false

  position.setXYZ(0, finiteGraphCoord(start.x), finiteGraphCoord(start.y), finiteGraphCoord(start.z))
  position.setXYZ(1, finiteGraphCoord(end.x), finiteGraphCoord(end.y), finiteGraphCoord(end.z))
  position.needsUpdate = true
  line.geometry.computeBoundingSphere?.()
  return true
}

export function updateCylinderLink(line, start, end) {
  linkStartVector.set(
    finiteGraphCoord(start.x),
    finiteGraphCoord(start.y),
    finiteGraphCoord(start.z)
  )
  linkEndVector.set(
    finiteGraphCoord(end.x),
    finiteGraphCoord(end.y),
    finiteGraphCoord(end.z)
  )

  // Self-links use a zero-length cylinder.
  line.scale.z = linkStartVector.distanceTo(linkEndVector)

  if (line.parent) {
    localStartVector.copy(linkStartVector)
    line.parent.worldToLocal(localStartVector)
    line.position.copy(localStartVector)

    line.lookAt(linkLookAtVector.copy(linkEndVector))
  } else {
    line.position.copy(linkStartVector)
    line.lookAt(linkEndVector)
  }

  return true
}

function addIncidentLink(incidentLinkMap, nodeId, link) {
  if (nodeId === undefined || nodeId === null) return

  const links = incidentLinkMap.get(nodeId) || []
  links.push(link)
  incidentLinkMap.set(nodeId, links)
}

function collectIncidentLinks(nodeId, links = []) {
  return links.filter(link => {
    const sourceId = linkEndpointId(link.source)
    const targetId = linkEndpointId(link.target)
    return sourceId === nodeId || targetId === nodeId
  })
}

function linkEndpointPosition(endpoint, getNode) {
  const node = endpoint && typeof endpoint === 'object' ? endpoint : getNode?.(endpoint)
  if (!node) return null

  return {
    x: finiteGraphCoord(node.x),
    y: finiteGraphCoord(node.y),
    z: finiteGraphCoord(node.z)
  }
}

export function finiteGraphCoord(value) {
  return Number.isFinite(value) ? value : 0
}

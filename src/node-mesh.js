import * as THREE from 'three'

export const NODE_VISIBLE_RADIUS = 4
export const NODE_PICK_RADIUS = 12
export const NODE_PICK_SEGMENTS = 8

const NODE_GEOMETRY = new THREE.SphereGeometry(NODE_VISIBLE_RADIUS, 16, 16)
const NODE_PICK_GEOMETRY = new THREE.SphereGeometry(
  NODE_PICK_RADIUS,
  NODE_PICK_SEGMENTS,
  NODE_PICK_SEGMENTS
)
const NODE_PICK_MATERIAL = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  side: THREE.DoubleSide
})

NODE_PICK_MATERIAL.colorWrite = false

export function createNodeMesh(node, { color, materialTracker }) {
  // Baseline emissive black so non-selected nodes stay below the bloom threshold.
  const material = materialTracker.track(
    new THREE.MeshLambertMaterial({
      color,
      emissive: 0x000000,
      emissiveIntensity: 0
    })
  )
  const mesh = new THREE.Mesh(NODE_GEOMETRY, material)
  const pickTarget = new THREE.Mesh(NODE_PICK_GEOMETRY, NODE_PICK_MATERIAL)

  pickTarget.userData = {
    isNodePickTarget: true
  }

  mesh.userData = {
    isNode: true,
    nodeId: node.id,
    node
  }
  mesh.add(pickTarget)

  return mesh
}

export function updateNodeMesh(mesh, node, color) {
  mesh.userData.isNode = true
  mesh.userData.nodeId = node.id
  mesh.userData.node = node
  delete mesh.userData.originalColor
  delete mesh.userData.originalEmissiveHex
  delete mesh.userData.originalEmissiveIntensity
  mesh.material.color.set(color)
  mesh.material.emissive.setHex(0x000000)
  mesh.material.emissiveIntensity = 0
  setNodeMeshScale(mesh, 1)
}

export function setNodeMeshScale(mesh, scale) {
  mesh.scale.set(scale, scale, scale)

  const pickTarget = getNodePickTarget(mesh)
  if (!pickTarget) return

  const pickTargetScale = scale === 0 ? 1 : 1 / scale
  pickTarget.scale.set(pickTargetScale, pickTargetScale, pickTargetScale)
}

function getNodePickTarget(mesh) {
  return mesh.children.find(child => child.userData?.isNodePickTarget)
}

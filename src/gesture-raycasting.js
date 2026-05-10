export function screenPointToNdc(point) {
  return {
    x: point.x * 2 - 1,
    y: 1 - point.y * 2
  }
}

export function findNodeAtScreenPoint(point, camera, scene, raycaster) {
  const ndc = screenPointToNdc(point)
  raycaster.setFromCamera(ndc, camera)

  const intersections = raycaster.intersectObjects(scene.children, true)
  for (const intersection of intersections) {
    const mesh = findNodeMesh(intersection.object)
    if (mesh) {
      return {
        nodeId: mesh.userData.nodeId,
        node: mesh.userData.node,
        mesh
      }
    }
  }

  return null
}

function findNodeMesh(object) {
  let current = object

  while (current) {
    if (current.userData?.isNode === true) return current
    current = current.parent
  }

  return null
}

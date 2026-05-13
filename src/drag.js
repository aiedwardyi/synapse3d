import * as THREE from 'three'
import { screenPointToNdc } from './gesture-raycasting.js'

export function createDragController() {
  const dragPlane = new THREE.Plane()
  const cameraForward = new THREE.Vector3()
  const nodePosition = new THREE.Vector3()
  const intersectionTarget = new THREE.Vector3()
  let targetNode = null

  function beginDrag(hit, camera) {
    targetNode = hit.node
    camera.getWorldDirection(cameraForward)
    nodePosition.copy(hit.mesh.position)
    dragPlane.setFromNormalAndCoplanarPoint(cameraForward, nodePosition)
  }

  function updateDrag(cursorPoint, camera, raycaster) {
    if (!targetNode) return

    const ndc = screenPointToNdc(cursorPoint)
    raycaster.setFromCamera(ndc, camera)

    const hitPoint = raycaster.ray.intersectPlane(dragPlane, intersectionTarget)
    if (!hitPoint) return

    targetNode.fx = hitPoint.x
    targetNode.fy = hitPoint.y
    targetNode.fz = hitPoint.z
  }

  function endDrag() {
    targetNode = null
  }

  function isDragging() {
    return targetNode !== null
  }

  function getTargetNode() {
    return targetNode
  }

  return { beginDrag, updateDrag, endDrag, isDragging, getTargetNode }
}

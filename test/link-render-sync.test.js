import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import {
  createIncidentLinkMap,
  syncIncidentLinkPositions,
  updateCylinderLink,
  updateLineGeometry
} from '../src/link-render-sync.js'

test('createIncidentLinkMap stores only incident links for each endpoint', () => {
  const alphaBeta = { source: 'alpha', target: { id: 'beta' } }
  const betaGamma = { source: { id: 'beta' }, target: 'gamma' }
  const selfLink = { source: 'alpha', target: 'alpha' }

  const map = createIncidentLinkMap([alphaBeta, betaGamma, selfLink])

  assert.deepEqual(map.get('alpha'), [alphaBeta, selfLink])
  assert.deepEqual(map.get('beta'), [alphaBeta, betaGamma])
  assert.deepEqual(map.get('gamma'), [betaGamma])
})

test('syncIncidentLinkPositions uses the incident map instead of scanning every link', () => {
  const incidentLink = { source: 'alpha', target: 'beta' }
  const unrelatedLink = { source: 'gamma', target: 'delta' }
  const syncedLinks = []
  const map = createIncidentLinkMap([incidentLink, unrelatedLink])

  syncIncidentLinkPositions(
    { id: 'alpha' },
    map,
    [unrelatedLink],
    link => syncedLinks.push(link)
  )

  assert.deepEqual(syncedLinks, [incidentLink])
})

test('updateLineGeometry writes start and end coordinates into a line buffer', () => {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
  const line = new THREE.Line(geometry)
  const initialVersion = geometry.getAttribute('position').version

  updateLineGeometry(
    line,
    { x: 1, y: 2, z: 3 },
    { x: 4, y: 5, z: 6 }
  )

  assert.deepEqual([...geometry.getAttribute('position').array], [1, 2, 3, 4, 5, 6])
  assert.equal(geometry.getAttribute('position').version, initialVersion + 1)
})

test('updateCylinderLink converts world endpoints into the parent local space', () => {
  const parent = new THREE.Object3D()
  parent.position.set(10, 0, 0)
  const line = new THREE.Mesh()
  parent.add(line)
  parent.updateMatrixWorld(true)

  updateCylinderLink(
    line,
    { x: 12, y: 0, z: 0 },
    { x: 12, y: 0, z: 5 }
  )

  assert.equal(line.position.x, 2)
  assert.equal(line.position.y, 0)
  assert.equal(line.position.z, 0)
  assert.equal(line.scale.z, 5)
})

test('updateCylinderLink points cylinders at the world-space end coordinate', () => {
  let lookAtTarget = null
  const line = {
    position: new THREE.Vector3(),
    scale: { z: 0 },
    parent: {
      localToWorld(vector) {
        vector.x += 10
        return vector
      },
      worldToLocal(vector) {
        vector.x -= 10
        return vector
      }
    },
    lookAt(target) {
      lookAtTarget = target.clone()
    }
  }

  updateCylinderLink(
    line,
    { x: 12, y: 0, z: 0 },
    { x: 12, y: 0, z: 5 }
  )

  assert.equal(line.position.x, 2)
  assert.deepEqual(lookAtTarget, new THREE.Vector3(12, 0, 5))
})

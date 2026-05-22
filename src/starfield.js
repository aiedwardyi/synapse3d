import * as THREE from 'three'

const DEFAULT_STAR_COUNT = 240
const DEFAULT_RADIUS = 1200
const DEFAULT_SIZE = 1.2
const DEFAULT_OPACITY = 0.28
const DEFAULT_COLOR = '#cfd8e8'
const DEFAULT_SHELL_INNER_RATIO = 0.82

export function createStarfield({
  count = DEFAULT_STAR_COUNT,
  radius = DEFAULT_RADIUS,
  size = DEFAULT_SIZE,
  opacity = DEFAULT_OPACITY,
  color = DEFAULT_COLOR,
  innerRatio = DEFAULT_SHELL_INNER_RATIO
} = {}) {
  const starCount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : DEFAULT_RADIUS
  const safeSize = Number.isFinite(size) && size > 0 ? size : DEFAULT_SIZE
  const safeOpacity = Number.isFinite(opacity) ? Math.min(Math.max(opacity, 0), 1) : DEFAULT_OPACITY
  const safeInnerRatio = Number.isFinite(innerRatio) ? Math.min(Math.max(innerRatio, 0), 1) : DEFAULT_SHELL_INNER_RATIO
  const positions = new Float32Array(starCount * 3)

  for (let i = 0; i < starCount; i++) {
    const point = randomPointInShell(safeRadius, safeInnerRatio)
    const index = i * 3
    positions[index] = point.x
    positions[index + 1] = point.y
    positions[index + 2] = point.z
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.computeBoundingSphere()

  const material = new THREE.PointsMaterial({
    color,
    size: safeSize,
    transparent: true,
    opacity: safeOpacity,
    depthWrite: false,
    sizeAttenuation: true
  })

  const starfield = new THREE.Points(geometry, material)
  starfield.frustumCulled = false
  starfield.userData.dispose = () => {
    geometry.dispose()
    material.dispose()
  }
  return starfield
}

function randomPointInShell(radius, innerRatio) {
  const theta = Math.random() * Math.PI * 2
  const z = Math.random() * 2 - 1
  const innerRadius = radius * innerRatio
  const innerRadiusCubed = innerRadius ** 3
  const radiusCubed = radius ** 3
  const distance = Math.cbrt(innerRadiusCubed + Math.random() * (radiusCubed - innerRadiusCubed))
  const xy = Math.sqrt(1 - z * z)

  return {
    x: distance * xy * Math.cos(theta),
    y: distance * xy * Math.sin(theta),
    z: distance * z
  }
}

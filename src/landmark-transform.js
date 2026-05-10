export function applyCoverTransform(landmark, sourceW, sourceH, containerW, containerH) {
  const scale = Math.max(containerW / sourceW, containerH / sourceH)
  const scaledW = sourceW * scale
  const scaledH = sourceH * scale
  const offsetX = (scaledW - containerW) / 2
  const offsetY = (scaledH - containerH) / 2

  return {
    x: (landmark.x * scaledW - offsetX) / containerW,
    y: (landmark.y * scaledH - offsetY) / containerH
  }
}

export function mirrorLandmarkX(landmark) {
  return {
    x: 1 - landmark.x,
    y: landmark.y
  }
}

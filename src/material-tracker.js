export function createMaterialTracker() {
  const materials = new Set()

  return {
    track(material) {
      materials.add(material)
      return material
    },
    disposeAll() {
      for (const material of materials) {
        material.dispose()
      }
      materials.clear()
    }
  }
}

export function createMaterialTracker() {
  const materials = new Set()

  return {
    track(material) {
      materials.add(material)
      return material
    },
    dispose(material) {
      if (!materials.delete(material)) return
      material.dispose()
    },
    disposeAll() {
      for (const material of materials) {
        material.dispose()
      }
      materials.clear()
    }
  }
}

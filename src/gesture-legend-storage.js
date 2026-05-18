const LEGEND_STORAGE_KEY = 'synapse3d.legend.seen'

export function hasSeenLegend() {
  try {
    return globalThis.localStorage?.getItem(LEGEND_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function markLegendSeen() {
  try {
    globalThis.localStorage?.setItem(LEGEND_STORAGE_KEY, 'true')
  } catch {
    // Private browsing modes can disable localStorage writes.
  }
}

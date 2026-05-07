import { get, set } from 'idb-keyval'

const IGNORE = ['.obsidian']
const CACHE_KEY = 'synapse3d-vault-handle'
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g
const TAG_RE = /(?:^|\s)#([a-zA-Z0-9_\-/]+)/g

// Opens the folder picker, saves the chosen folder, returns it.
export async function pickVault() {
  const handle = await window.showDirectoryPicker()
  await set(CACHE_KEY, handle)
  return handle
}

// Returns the cached handle if one exists. Doesn't touch permission.
export async function getCachedVault() {
  const handle = await get(CACHE_KEY)
  return handle || null
}

// True if read permission is already granted. Safe on page load.
export async function hasVaultPermission(handle) {
  const status = await handle.queryPermission({ mode: 'read' })
  return status === 'granted'
}

// Prompts for read permission. MUST be called from a user gesture.
export async function requestVaultPermission(handle) {
  const granted = await handle.requestPermission({ mode: 'read' })
  return granted === 'granted'
}

// Walks the vault, parses every .md file, returns nodes + links + stats.
export async function parseVault(rootHandle) {
  const stats = {
    filesScanned: 0,
    filesIgnored: 0,
    nodesCreated: 0,
    linksCreated: 0,
    brokenLinks: 0
  }

  const nodes = []
  const rawLinks = []
  const filenameToId = new Map()

  for await (const file of walkVault(rootHandle, '', stats)) {
    const id = file.path
    const label = file.name.replace(/\.md$/, '')
    const tags = extractTags(file.text)

    nodes.push({ id, label, tags, missing: false })

    if (!filenameToId.has(label)) {
      filenameToId.set(label, id)
    }

    for (const target of extractWikilinks(file.text)) {
      rawLinks.push({ source: id, target })
    }
  }

  const links = resolveLinks(nodes, rawLinks, filenameToId, stats)

  stats.nodesCreated = nodes.length
  stats.linksCreated = links.length

  return { nodes, links, stats }
}

async function* walkVault(dirHandle, relPath, stats) {
  for await (const entry of dirHandle.values()) {
    const entryPath = relPath ? `${relPath}/${entry.name}` : entry.name

    if (entry.kind === 'directory') {
      const ignored = IGNORE.some(
        prefix => entryPath === prefix || entryPath.startsWith(prefix + '/')
      )
      if (ignored) {
        stats.filesIgnored++
        continue
      }
      yield* walkVault(entry, entryPath, stats)
      continue
    }

    if (entry.kind === 'file' && entry.name.endsWith('.md')) {
      const file = await entry.getFile()
      const text = await file.text()
      stats.filesScanned++
      yield { path: entryPath, name: entry.name, text }
    }
  }
}

function extractWikilinks(text) {
  const targets = []
  for (const match of text.matchAll(WIKILINK_RE)) {
    const raw = match[1]
    const target = raw.split('|')[0].split('#')[0].trim()
    if (target) targets.push(target)
  }
  return targets
}

function extractTags(text) {
  const tags = []
  for (const match of text.matchAll(TAG_RE)) {
    tags.push(match[1])
  }
  return tags
}

function resolveLinks(nodes, rawLinks, filenameToId, stats) {
  const links = []
  const placeholders = new Map()

  for (const { source, target } of rawLinks) {
    let targetId = filenameToId.get(target)

    if (!targetId) {
      if (!placeholders.has(target)) {
        const placeholder = {
          id: target,
          label: target,
          tags: [],
          missing: true
        }
        placeholders.set(target, placeholder)
        nodes.push(placeholder)
        filenameToId.set(target, target)
      }
      targetId = target
      stats.brokenLinks++
    }

    links.push({ source, target: targetId })
  }

  return links
}

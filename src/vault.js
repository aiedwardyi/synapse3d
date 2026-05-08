import { get, set } from 'idb-keyval'

const IGNORE = ['.obsidian']
const CACHE_KEY = 'synapse3d-vault-handle'
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g
const TAG_RE = /(?:^|\s)#([\p{L}\p{M}\p{N}\p{Pc}\p{Pd}\/\p{S}\u200d]+)/gu
const MARKDOWN_EXTENSION_RE = /\.md$/i

// Opens the folder picker, saves the chosen folder, returns it.
export async function pickVault() {
  if (typeof window === 'undefined' || !window.showDirectoryPicker) {
    throw new Error('Your browser does not support folder picking.')
  }

  const handle = await window.showDirectoryPicker()

  try {
    await set(CACHE_KEY, handle)
  } catch (err) {
    console.warn('Unable to cache vault handle:', err)
  }

  return handle
}

// Returns the cached handle if one exists. Doesn't touch permission.
export async function getCachedVault() {
  try {
    const handle = await get(CACHE_KEY)
    return handle || null
  } catch (err) {
    console.warn('Unable to read cached vault handle:', err)
    return null
  }
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
    dirsIgnored: 0,
    fileReadErrors: 0,
    nodesCreated: 0,
    linksCreated: 0,
    brokenLinks: 0,
    ambiguousLinks: 0
  }

  const nodes = []
  const rawLinks = []
  const noteIndex = createNoteIndex()

  for await (const file of walkVault(rootHandle, '', stats)) {
    const id = file.path
    const label = stripMarkdownExtension(file.name)
    const tags = extractTags(file.text)

    nodes.push({ id, label, tags, missing: false })
    addNoteToIndex(noteIndex, id, label)

    for (const target of extractWikilinks(file.text)) {
      rawLinks.push({ source: id, target })
    }
  }

  const links = resolveLinks(nodes, rawLinks, noteIndex, stats)

  stats.nodesCreated = nodes.length
  stats.linksCreated = links.length

  return { nodes, links, stats }
}

async function* walkVault(dirHandle, relPath, stats) {
  const entries = []

  for await (const entry of dirHandle.values()) {
    entries.push(entry)
  }

  entries.sort((a, b) => a.name.localeCompare(b.name))

  for (const entry of entries) {
    const entryPath = relPath ? `${relPath}/${entry.name}` : entry.name

    if (entry.kind === 'directory') {
      const ignored = IGNORE.some(
        prefix => entryPath === prefix || entryPath.startsWith(prefix + '/')
      )
      if (ignored) {
        stats.dirsIgnored++
        continue
      }
      yield* walkVault(entry, entryPath, stats)
      continue
    }

    if (entry.kind === 'file' && isMarkdownFile(entry.name)) {
      try {
        const file = await entry.getFile()
        const text = await file.text()
        stats.filesScanned++
        yield { path: entryPath, name: entry.name, text }
      } catch (err) {
        stats.fileReadErrors++
        console.warn(`Unable to read markdown file "${entryPath}":`, err)
      }
    }
  }
}

function extractWikilinks(text) {
  const targets = []
  for (const match of text.matchAll(WIKILINK_RE)) {
    const raw = match[1]
    const target = normalizeTarget(raw.split('|')[0].split('#')[0])
    if (target) targets.push(target)
  }
  return targets
}

function extractTags(text) {
  const tags = []
  for (const match of text.matchAll(TAG_RE)) {
    tags.push(match[1].toLowerCase())
  }
  return tags
}

function createNoteIndex() {
  return {
    pathToId: new Map(),
    basenameToIds: new Map()
  }
}

function addNoteToIndex(index, id, label) {
  const path = normalizePath(normalizeTarget(id))
  index.pathToId.set(path, id)
  index.pathToId.set(stripMarkdownExtension(path), id)

  const ids = index.basenameToIds.get(label) || []
  ids.push(id)
  ids.sort((a, b) => a.localeCompare(b))
  index.basenameToIds.set(label, ids)
}

function resolveLinks(nodes, rawLinks, noteIndex, stats) {
  const links = []
  const placeholders = new Map()
  const linkKeys = new Set()
  const nodeIds = new Set(nodes.map(node => node.id))

  for (const { source, target } of rawLinks) {
    const resolved = resolveTarget(source, target, noteIndex)
    let targetId = resolved.id

    if (!targetId) {
      const placeholderTarget = resolved.target || stripMarkdownExtension(normalizeTarget(target))
      const placeholderKey = `${resolved.reason}:${placeholderTarget}`
      if (!placeholders.has(placeholderKey)) {
        const placeholderId = uniquePlaceholderId(placeholderKey, nodeIds)
        const placeholder = {
          id: placeholderId,
          label: placeholderTarget,
          tags: [],
          missing: true,
          ambiguous: resolved.reason === 'ambiguous'
        }
        placeholders.set(placeholderKey, placeholder)
        nodes.push(placeholder)
        nodeIds.add(placeholderId)
      }
      targetId = placeholders.get(placeholderKey).id

      if (resolved.reason === 'ambiguous') {
        stats.ambiguousLinks++
      } else {
        stats.brokenLinks++
      }
    }

    const linkKey = `${source}\u0000${targetId}`
    if (linkKeys.has(linkKey)) {
      continue
    }
    linkKeys.add(linkKey)

    links.push({ source, target: targetId })
  }

  return links
}

function resolveTarget(source, target, noteIndex) {
  const normalized = normalizeTarget(target)

  if (normalized.includes('/')) {
    const pathTarget = resolveLinkPath(source, normalized)
    const pathId = resolvePathTarget(pathTarget, noteIndex)
    return pathId ? { id: pathId } : { reason: 'missing', target: stripMarkdownExtension(pathTarget) }
  }

  const label = stripMarkdownExtension(normalized)
  const sourceDir = dirname(source)
  const sameFolderTarget = sourceDir ? `${sourceDir}/${label}` : label
  const sameFolderId = resolvePathTarget(sameFolderTarget, noteIndex)

  if (sameFolderId) {
    return { id: sameFolderId }
  }

  const ids = noteIndex.basenameToIds.get(label) || []

  if (ids.length === 1) {
    return { id: ids[0] }
  }

  if (ids.length > 1) {
    return { reason: 'ambiguous', target: label }
  }

  return { reason: 'missing', target: label }
}

function resolvePathTarget(target, noteIndex) {
  return noteIndex.pathToId.get(target) || noteIndex.pathToId.get(stripMarkdownExtension(target))
}

function resolveLinkPath(source, target) {
  const scopedTarget = isRelativeTarget(target) ? `${dirname(source)}/${target}` : target
  return normalizePath(scopedTarget)
}

function isRelativeTarget(target) {
  return target.startsWith('./') || target.startsWith('../')
}

function normalizeTarget(value) {
  return value
    .trim()
    .replaceAll('\\', '/')
    .replace(/\/+/g, '/')
    .replace(/^\/|\/$/g, '')
}

function stripMarkdownExtension(value) {
  return value.replace(MARKDOWN_EXTENSION_RE, '')
}

function isMarkdownFile(name) {
  return MARKDOWN_EXTENSION_RE.test(name)
}

function normalizePath(path) {
  const segments = []

  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue

    if (segment === '..') {
      if (segments.length > 0) segments.pop()
      continue
    }

    segments.push(segment)
  }

  return segments.join('/')
}

function dirname(path) {
  const index = path.lastIndexOf('/')
  return index === -1 ? '' : path.slice(0, index)
}

function uniquePlaceholderId(key, nodeIds) {
  const base = `missing:${key}`
  let id = base
  let suffix = 2

  while (nodeIds.has(id)) {
    id = `${base}:${suffix}`
    suffix++
  }

  return id
}

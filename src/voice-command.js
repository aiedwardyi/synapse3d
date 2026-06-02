const DEFAULT_WAKE_WORDS = ['claude', 'claud', 'cloud', 'clod', 'clyde', 'clan']
export const COMMAND_PREFIXES = ['show me', 'go to', 'open', 'read', 'show']

const CLOSE_COMMANDS = new Set(['close', 'close note', 'close reader'])
const NEXT_COMMANDS = new Set(['next', 'next note', 'next link'])
const PREV_COMMANDS = new Set(['back', 'prev', 'previous', 'back note', 'prev note', 'previous note', 'prev link', 'previous link', 'go back'])
const CLEAR_COMMANDS = new Set(['clear', 'clear selection', 'deselect'])
const RECENTER_COMMANDS = new Set(['center', 'reset', 'recenter', 'reset view', 'reset camera'])
const ZOOM_DIRECTIONS = { 'zoom in': 'in', 'zoom out': 'out' }
const ROTATE_DIRECTIONS = {
  'rotate left': 'left',
  'rotate right': 'right',
  'rotate up': 'up',
  'rotate down': 'down'
}

export function parseVoiceCommand(command) {
  const normalized = normalizeText(command)
  if (!normalized) return null

  if (CLOSE_COMMANDS.has(normalized)) return { action: 'close' }
  if (NEXT_COMMANDS.has(normalized)) return { action: 'next' }
  if (PREV_COMMANDS.has(normalized)) return { action: 'prev' }
  if (CLEAR_COMMANDS.has(normalized)) return { action: 'clear' }
  if (RECENTER_COMMANDS.has(normalized)) return { action: 'recenter' }

  if (Object.hasOwn(ZOOM_DIRECTIONS, normalized)) {
    return { action: 'zoom', arg: ZOOM_DIRECTIONS[normalized] }
  }
  if (Object.hasOwn(ROTATE_DIRECTIONS, normalized)) {
    return { action: 'rotate', arg: ROTATE_DIRECTIONS[normalized] }
  }

  if (normalized.startsWith('select ')) {
    const arg = normalized.slice('select '.length).trim()
    if (arg) return { action: 'select', arg }
  }

  return null
}

export function extractDirectCommand(transcript) {
  const normalized = normalizeText(transcript)
  if (!normalized) return null

  if (parseVoiceCommand(normalized)) return normalized

  const sorted = [...COMMAND_PREFIXES].sort((a, b) => b.length - a.length)
  for (const prefix of sorted) {
    if (normalized === prefix) return null
    if (normalized.startsWith(`${prefix} `)) return normalized
  }
  return null
}

export function extractWakeCommand(transcript, { wakeWords = DEFAULT_WAKE_WORDS } = {}) {
  const normalized = normalizeText(transcript)
  if (!normalized) return null

  const wakeSet = new Set(wakeWords.map(word => normalizeText(word)).filter(Boolean))
  const tokens = normalized.split(' ')

  for (let i = 0; i < tokens.length; i++) {
    if (wakeSet.has(tokens[i])) {
      return tokens.slice(i + 1).join(' ').trim()
    }
  }

  return null
}

export function matchNoteCommand(command, nodes, { stripPrefix = true } = {}) {
  const normalized = normalizeText(command)
  if (!normalized) return null

  const query = stripPrefix ? stripCommandPrefix(normalized) : normalized
  if (!query) return null

  const candidates = Array.isArray(nodes) ? nodes : []
  const matches = []

  for (const node of candidates) {
    if (!node || node.missing || node.id == null) continue

    const labelText = nodeLabelText(node)
    const normalizedLabel = normalizeText(labelText)
    if (!normalizedLabel) continue

    const matchType = matchAgainstLabel(query, normalizedLabel)
    if (!matchType) continue

    matches.push({
      nodeId: node.id,
      label: labelText,
      matchType,
      labelLength: normalizedLabel.length
    })
  }

  if (matches.length === 0) return null

  matches.sort(byMatchPreference)
  const best = matches[0]
  return { nodeId: best.nodeId, label: best.label, matchType: best.matchType }
}

function matchAgainstLabel(query, label) {
  if (label === query) return 'exact'
  if (hasWordPrefix(query, label)) return 'substring'
  if (allQueryWordsHaveWordPrefix(query, label)) return 'all-words'
  return null
}

function hasWordPrefix(query, label) {
  // Match at a word boundary: "alpha" hits "Alpha Notes" but "rust" does not hit "Trust".
  return label.startsWith(query) || label.includes(` ${query}`)
}

function allQueryWordsHaveWordPrefix(query, label) {
  const queryWords = query.split(' ').filter(Boolean)
  if (queryWords.length === 0) return false
  return queryWords.every(word => hasWordPrefix(word, label))
}

export function stripCommandPrefix(text) {
  const sorted = [...COMMAND_PREFIXES].sort((a, b) => b.length - a.length)
  for (const prefix of sorted) {
    if (text === prefix) return ''
    if (text.startsWith(`${prefix} `)) return text.slice(prefix.length + 1).trim()
  }
  return text
}

function normalizeText(text) {
  if (typeof text !== 'string') return ''
  return text
    .toLowerCase()
    .replace(/[.,!?;:"'`(){}\[\]\-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function nodeLabelText(node) {
  if (typeof node.label === 'string' && node.label.trim()) return node.label
  return String(node.id)
}

const MATCH_ORDER = { exact: 0, substring: 1, 'all-words': 2 }

function byMatchPreference(a, b) {
  if (MATCH_ORDER[a.matchType] !== MATCH_ORDER[b.matchType]) {
    return MATCH_ORDER[a.matchType] - MATCH_ORDER[b.matchType]
  }
  return a.labelLength - b.labelLength
}

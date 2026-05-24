const DEFAULT_WAKE_WORDS = ['claude', 'claud', 'cloud', 'clod']
const COMMAND_PREFIXES = ['show me', 'go to', 'open', 'read', 'show']

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

export function matchNoteCommand(command, nodes) {
  const normalized = normalizeText(command)
  if (!normalized) return null

  const query = stripCommandPrefix(normalized)
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
  if (label.includes(query)) return 'substring'
  if (allWordsPresent(query, label)) return 'all-words'
  return null
}

function allWordsPresent(query, label) {
  const words = query.split(' ').filter(Boolean)
  if (words.length === 0) return false
  return words.every(word => label.includes(word))
}

function stripCommandPrefix(text) {
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
    .replace(/[.,!?;:"'`(){}\[\]]/g, ' ')
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

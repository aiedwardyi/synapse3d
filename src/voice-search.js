const COMMAND_PREFIXES = ['show me', 'go to', 'open', 'read', 'show']
const LABEL_WEIGHT = 10
const TAG_WEIGHT = 5
const CONTENT_WEIGHT = 1
const DEFAULT_LIMIT = 8
const SNIPPET_BEFORE = 60
const SNIPPET_AFTER = 100
const REGEX_ESCAPE_RE = /[.*+?^${}()|[\]\\]/g
const NORMALIZE_RE = /[.,!?;:"'`(){}\[\]\-_/]/g

export function searchNotes(query, nodes, { limit = DEFAULT_LIMIT } = {}) {
  const stripped = stripCommandPrefix(normalize(query))
  if (!stripped) return []

  const terms = stripped.split(' ').filter(Boolean)
  if (terms.length === 0) return []

  if (!Array.isArray(nodes) || nodes.length === 0) return []

  const scored = []

  for (const node of nodes) {
    if (!node || node.missing || node.id == null) continue

    const score = scoreNode(node, terms)
    if (score <= 0) continue

    const snippet = buildSnippet(typeof node.content === 'string' ? node.content : '', terms)

    scored.push({
      id: node.id,
      label: typeof node.label === 'string' && node.label ? node.label : String(node.id),
      snippet,
      modified: Number.isFinite(node.modified) ? node.modified : 0,
      _score: score
    })
  }

  scored.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score
    if (b.modified !== a.modified) return b.modified - a.modified
    return String(a.id).localeCompare(String(b.id))
  })

  return scored.slice(0, limit).map(({ _score, ...rest }) => rest)
}

function scoreNode(node, terms) {
  const labelText = normalize(node.label || '')
  const tagTexts = Array.isArray(node.tags) ? node.tags.map(tag => normalize(tag)) : []
  const contentLower = typeof node.content === 'string' ? node.content.toLowerCase() : ''

  let score = 0
  for (const term of terms) {
    score += countWordOccurrences(labelText, term) * LABEL_WEIGHT
    for (const tag of tagTexts) {
      score += countWordOccurrences(tag, term) * TAG_WEIGHT
    }
    score += countWordOccurrences(contentLower, term) * CONTENT_WEIGHT
  }
  return score
}

function buildSnippet(content, terms) {
  if (!content) return ''

  const lower = content.toLowerCase()
  let bestIndex = -1
  for (const term of terms) {
    const idx = findWordIndex(lower, term)
    if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) bestIndex = idx
  }
  if (bestIndex === -1) return ''

  const start = Math.max(0, bestIndex - SNIPPET_BEFORE)
  const end = Math.min(content.length, bestIndex + SNIPPET_AFTER)
  let excerpt = content.slice(start, end).replace(/\s+/g, ' ').trim()
  if (start > 0) excerpt = `...${excerpt}`
  if (end < content.length) excerpt = `${excerpt}...`
  return excerpt
}

function countWordOccurrences(haystack, term) {
  if (!haystack || !term) return 0
  const re = new RegExp(`\\b${escapeRegex(term)}\\b`, 'g')
  let count = 0
  while (re.exec(haystack) !== null) count++
  return count
}

function findWordIndex(haystack, term) {
  if (!haystack || !term) return -1
  const re = new RegExp(`\\b${escapeRegex(term)}\\b`)
  const match = re.exec(haystack)
  return match ? match.index : -1
}

function escapeRegex(value) {
  return value.replace(REGEX_ESCAPE_RE, '\\$&')
}

function normalize(text) {
  if (typeof text !== 'string') return ''
  return text
    .toLowerCase()
    .replace(NORMALIZE_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripCommandPrefix(text) {
  const sorted = [...COMMAND_PREFIXES].sort((a, b) => b.length - a.length)
  for (const prefix of sorted) {
    if (text === prefix) return ''
    if (text.startsWith(`${prefix} `)) return text.slice(prefix.length + 1).trim()
  }
  return text
}

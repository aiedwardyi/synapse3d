import { COMMAND_PREFIXES } from './voice-command.js'

const STOPWORDS = new Set([
  'the', 'a', 'an',
  'and', 'or', 'but',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'as', 'about', 'from',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'has', 'have', 'had',
  'that', 'this', 'these', 'those', 'it', 'its',
  'me', 'my', 'we', 'you', 'us', 'they', 'them',
  'file', 'files', 'note', 'notes', 'page', 'pages', 'doc', 'document'
])
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

  const allTokens = stripped.split(' ').filter(Boolean)
  if (allTokens.length === 0) return []
  // If filtering would leave nothing, keep the originals so a note titled
  // exactly "Notes" or "Files" can still resolve via voice.
  const meaningful = allTokens.filter(t => !STOPWORDS.has(t))
  const terms = meaningful.length > 0 ? meaningful : allTokens

  if (!Array.isArray(nodes) || nodes.length === 0) return []

  const scored = []
  // First positive-scoring node per id wins. A later duplicate with a higher
  // score will be silently dropped, but ids should be unique in a healthy
  // vault so this is acceptable. Do not move seen.add above the score check:
  // a zero-scoring first duplicate must not suppress a later positive match.
  const seen = new Set()

  for (const node of nodes) {
    if (!node || node.missing || node.id == null || seen.has(node.id)) continue

    const score = scoreNode(node, terms)
    if (score <= 0) continue

    seen.add(node.id)

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
  const contentForMatch = normalizeForMatching(typeof node.content === 'string' ? node.content : '')

  let score = 0
  for (const term of terms) {
    score += countWordOccurrences(labelText, term) * LABEL_WEIGHT
    for (const tag of tagTexts) {
      score += countWordOccurrences(tag, term) * TAG_WEIGHT
    }
    score += countWordOccurrences(contentForMatch, term) * CONTENT_WEIGHT
  }
  return score
}

function buildSnippet(content, terms) {
  if (!content) return ''

  // Length-preserving so match.index aligns with the original content.
  const haystack = normalizeForMatching(content)
  let earliestMatchIndex = -1
  for (const term of terms) {
    const idx = findWordIndex(haystack, term)
    if (idx !== -1 && (earliestMatchIndex === -1 || idx < earliestMatchIndex)) earliestMatchIndex = idx
  }
  if (earliestMatchIndex === -1) return ''

  const start = Math.max(0, earliestMatchIndex - SNIPPET_BEFORE)
  const end = Math.min(content.length, earliestMatchIndex + SNIPPET_AFTER)
  let excerpt = content.slice(start, end).replace(/\s+/g, ' ').trim()
  if (start > 0) excerpt = `...${excerpt}`
  if (end < content.length) excerpt = `${excerpt}...`
  return excerpt
}

function countWordOccurrences(haystack, term) {
  if (!haystack || !term) return 0
  const re = buildBoundaryRegex(term, { global: true })
  let count = 0
  while (re.exec(haystack) !== null) count++
  return count
}

function findWordIndex(haystack, term) {
  if (!haystack || !term) return -1
  const match = buildBoundaryRegex(term).exec(haystack)
  return match ? match.index : -1
}

// Lookaround boundaries so terms ending in non-word chars ("85%") and
// non-ASCII letters ("résumé") still match. Uses Unicode letter/number
// classes so "sumé" does not match inside "résumé" (\b alone is
// ASCII-only in JS and treats é as a boundary).
function buildBoundaryRegex(term, { global = false } = {}) {
  return new RegExp(
    `(?<=^|[^\\p{L}\\p{N}])${escapeRegex(term)}(?=[^\\p{L}\\p{N}]|$)`,
    global ? 'gu' : 'u'
  )
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

// Length-preserving variant so body match indices map back to original content.
function normalizeForMatching(text) {
  if (typeof text !== 'string') return ''
  return text.toLowerCase().replace(NORMALIZE_RE, ' ')
}

function stripCommandPrefix(text) {
  const sorted = [...COMMAND_PREFIXES].sort((a, b) => b.length - a.length)
  for (const prefix of sorted) {
    if (text === prefix) return ''
    if (text.startsWith(`${prefix} `)) return text.slice(prefix.length + 1).trim()
  }
  return text
}

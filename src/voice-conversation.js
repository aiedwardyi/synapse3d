const DEFAULT_MAX_ROUNDS = 2

const RECENCY_TERMS = new Set([
  'recent', 'newer', 'newest', 'latest', 'recently'
])

const ANSWER_STOPWORDS = new Set([
  'the', 'a', 'an',
  'one', 'this', 'that', 'these', 'those', 'it',
  'is', 'are', 'was', 'were', 'be',
  'and', 'or', 'but',
  'note', 'notes', 'file', 'files', 'doc', 'docs', 'document',
  'please', 'just', 'open', 'show', 'read', 'go', 'to', 'me'
])

const NORMALIZE_RE = /[.,!?;:"'`(){}\[\]\-_/]/g

export function startConversation({ command, candidates, graphVersion, maxRounds = DEFAULT_MAX_ROUNDS } = {}) {
  const candidateList = Array.isArray(candidates) ? candidates : []
  return {
    phase: 'pending_api',
    candidates: candidateList,
    graphVersion,
    messages: [buildInitialUserMessage(command, candidateList)],
    rounds: 0,
    maxRounds,
    askMeta: null,
    result: null,
    reason: null
  }
}

export function applyResponse(state, response) {
  if (isTerminal(state)) return state

  if (!response) {
    return { ...state, phase: 'aborted', reason: 'no_match' }
  }

  if (response.type === 'open' && response.nodeId != null) {
    return { ...state, phase: 'resolved', result: { nodeId: response.nodeId } }
  }

  if (
    response.type === 'ask' &&
    response.toolUseId &&
    Array.isArray(response.options) &&
    response.options.length > 0
  ) {
    return {
      ...state,
      phase: 'pending_user',
      messages: [
        ...state.messages,
        { role: 'assistant', content: response.assistantBlocks || [] }
      ],
      askMeta: {
        toolUseId: response.toolUseId,
        question: response.question || '',
        options: response.options
      }
    }
  }

  return { ...state, phase: 'aborted', reason: 'no_match' }
}

export function applyAnswer(state, answerText) {
  if (state?.phase !== 'pending_user' || !state.askMeta) return state

  const shortcutId = resolveShortcut(answerText, state.candidates, state.askMeta)
  if (shortcutId != null) {
    return { ...state, phase: 'resolved', result: { nodeId: shortcutId } }
  }

  const newRounds = state.rounds + 1
  if (newRounds >= state.maxRounds) {
    return { ...state, phase: 'aborted', reason: 'round_cap', rounds: newRounds }
  }

  return {
    ...state,
    phase: 'pending_api',
    rounds: newRounds,
    messages: [
      ...state.messages,
      {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: state.askMeta.toolUseId,
          content: typeof answerText === 'string' ? answerText : String(answerText ?? '')
        }]
      }
    ]
  }
}

export function abort(state, reason) {
  if (isTerminal(state)) return state
  return { ...state, phase: 'aborted', reason }
}

export function isStale(state, currentGraphVersion) {
  return state?.graphVersion !== currentGraphVersion
}

export function isTerminal(state) {
  return state?.phase === 'resolved' || state?.phase === 'aborted'
}

function buildInitialUserMessage(command, candidates) {
  const promptCandidates = candidates.map(c => ({
    id: c.id,
    label: c.label,
    snippet: c.snippet,
    modified: c.modified
  }))
  const trimmed = typeof command === 'string' ? command.trim() : ''
  return {
    role: 'user',
    content: `Request: ${trimmed}\n\nCandidate notes:\n${JSON.stringify(promptCandidates, null, 2)}`
  }
}

function resolveShortcut(answerText, candidates, askMeta) {
  if (!askMeta || !Array.isArray(askMeta.options) || askMeta.options.length === 0) return null

  const normalized = normalize(answerText)
  if (!normalized) return null

  const answerWords = normalized.split(' ').filter(Boolean)
  const meaningfulWords = answerWords.filter(w => !ANSWER_STOPWORDS.has(w))

  // Label match first: a single answer word that is unique to one option's label.
  const labelMatch = pickByUniqueLabelWord(meaningfulWords, askMeta.options)
  if (labelMatch != null) return labelMatch

  // Recency keyword fallback: pick option whose underlying candidate has max modified.
  if (answerWords.some(w => RECENCY_TERMS.has(w))) {
    return pickByMostRecent(askMeta.options, candidates)
  }

  return null
}

function pickByUniqueLabelWord(answerWords, options) {
  if (answerWords.length === 0) return null

  const wordToOptions = new Map()
  for (const opt of options) {
    const labelWords = new Set(
      normalize(opt.label).split(' ').filter(w => w && !ANSWER_STOPWORDS.has(w))
    )
    for (const w of labelWords) {
      const set = wordToOptions.get(w) || new Set()
      set.add(opt.nodeId)
      wordToOptions.set(w, set)
    }
  }

  for (const w of answerWords) {
    const set = wordToOptions.get(w)
    if (set && set.size === 1) {
      return [...set][0]
    }
  }

  return null
}

function pickByMostRecent(options, candidates) {
  if (options.length === 0) return null

  const byOriginalId = new Map(
    candidates.map(c => [c.originalId != null ? c.originalId : c.id, c])
  )

  let bestId = null
  let bestModified = -Infinity
  for (const opt of options) {
    const cand = byOriginalId.get(opt.nodeId)
    const modified = Number.isFinite(cand?.modified) ? cand.modified : 0
    if (modified > bestModified) {
      bestModified = modified
      bestId = opt.nodeId
    }
  }
  return bestId
}

function normalize(text) {
  if (typeof text !== 'string') return ''
  return text
    .toLowerCase()
    .replace(NORMALIZE_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

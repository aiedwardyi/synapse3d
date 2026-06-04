import { searchNotes } from './voice-search.js'
import { CANDIDATES_HEADER } from './voice-message-format.js'

const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-haiku-4-5'
const ANTHROPIC_VERSION = '2023-06-01'
const OPEN_TOOL_NAME = 'open_note'
const ASK_TOOL_NAME = 'ask_clarification'
const MAX_TOKENS = 512
const SEARCH_LIMIT = 8
const REQUEST_TIMEOUT_MS = 8000
const SYSTEM_PROMPT = [
  'You help a user navigate a small knowledge graph by voice.',
  'You receive the spoken request and a JSON list of candidate notes: id, label, snippet (excerpt of the note body), and modified (file last-modified time as epoch milliseconds; larger = more recent).',
  'When one candidate is clearly the best match for the request based on its label or snippet, call open_note with that candidate id.',
  'When two or three candidates plausibly match and a short follow-up question would let the user pick, call ask_clarification with a brief question and a small list of those candidates as options (each option is { nodeId, label }). Limit options to at most three of the strongest candidates and phrase the question naturally.',
  'When candidates tie purely on recency, prefer the most recently modified one and call open_note directly instead of asking.',
  'When no candidate plausibly fits, do not call any tool.'
].join(' ')

export function encodeSearchCandidates(command, nodes) {
  if (typeof command !== 'string' || !command.trim()) return []
  const searchResults = searchNotes(command, nodes, { limit: SEARCH_LIMIT })
  return encodeCandidates(searchResults)
}

// Move the candidate list into its own content block carrying a cache_control
// breakpoint. The candidates + tools stay constant across clarification rounds,
// so subsequent calls in the same conversation hit the cache.
export function withCandidateCacheBreakpoint(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return messages
  const first = messages[0]
  if (typeof first?.content !== 'string') return messages

  const idx = first.content.indexOf(CANDIDATES_HEADER)
  if (idx === -1) return messages

  const requestText = first.content.slice(0, idx).replace(/\s+$/, '')
  if (!requestText) return messages

  const candidatesText = first.content.slice(idx)

  const transformedFirst = {
    ...first,
    content: [
      { type: 'text', text: requestText },
      { type: 'text', text: candidatesText, cache_control: { type: 'ephemeral' } }
    ]
  }

  return [transformedFirst, ...messages.slice(1)]
}

export async function callIntent({ messages, candidates }, { apiKey } = {}) {
  if (!Array.isArray(messages) || messages.length === 0) return null
  if (!Array.isArray(candidates) || candidates.length === 0) return null
  if (typeof apiKey !== 'string' || !apiKey) return null

  const response = await sendMessagesRequest({ messages, candidates, apiKey })
  if (!response) return null

  return normalizeResponse(response, candidates)
}

// Fire one minimal request when voice is enabled so the first real command does
// not pay TLS and connection setup or a cold cache. The candidate is a throwaway
// and the response is ignored; the call only needs to open the connection and
// prime the static system + tools prefix where caching applies. Fire-and-forget:
// it must never block voice start or throw, so any failure is swallowed.
export function warmUpIntent({ apiKey } = {}) {
  if (typeof apiKey !== 'string' || !apiKey) return
  sendMessagesRequest({
    messages: [{ role: 'user', content: 'warm up' }],
    candidates: [{ id: 'warmup' }],
    apiKey
  }).catch(() => {})
}

function encodeCandidates(searchResults) {
  const stringIdsInUse = new Set()
  const candidates = []

  for (const result of searchResults) {
    let id = String(result.id)
    if (stringIdsInUse.has(id)) {
      let suffix = 2
      while (stringIdsInUse.has(`${id}__${suffix}`)) suffix++
      id = `${id}__${suffix}`
    }
    stringIdsInUse.add(id)

    candidates.push({
      id,
      label: result.label,
      snippet: result.snippet,
      modified: result.modified,
      originalId: result.id
    })
  }

  return candidates
}

async function sendMessagesRequest({ messages, candidates, apiKey }) {
  const ids = candidates.map(c => c.id)
  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tool_choice: { type: 'auto' },
    messages: withCandidateCacheBreakpoint(messages),
    tools: [
      {
        name: OPEN_TOOL_NAME,
        description: 'Open the candidate note that best matches the request.',
        input_schema: {
          type: 'object',
          properties: {
            nodeId: {
              type: 'string',
              enum: ids,
              description: 'The id of the candidate note to open.'
            }
          },
          required: ['nodeId']
        }
      },
      {
        name: ASK_TOOL_NAME,
        description: 'Ask the user a short follow-up question when two or three candidates plausibly match.',
        input_schema: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'A brief spoken question to disambiguate. Plain text, no markup.'
            },
            options: {
              type: 'array',
              minItems: 2,
              maxItems: 3,
              items: {
                type: 'object',
                properties: {
                  nodeId: { type: 'string', enum: ids },
                  label: { type: 'string' }
                },
                required: ['nodeId', 'label']
              }
            }
          },
          required: ['question', 'options']
        },
        cache_control: { type: 'ephemeral' }
      }
    ]
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    })
  } catch (err) {
    if (err?.name === 'AbortError') {
      console.warn('voice-intent: request timed out')
    } else {
      console.warn('voice-intent: network failure', err)
    }
    return null
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    console.warn('voice-intent: non-ok response', response.status)
    return null
  }

  try {
    return await response.json()
  } catch (err) {
    console.warn('voice-intent: could not parse response', err)
    return null
  }
}

function normalizeResponse(response, candidates) {
  const blocks = Array.isArray(response?.content) ? response.content : []
  const byEncodedId = new Map(candidates.map(c => [c.id, c]))

  for (const block of blocks) {
    if (block?.type !== 'tool_use') continue

    if (block.name === OPEN_TOOL_NAME) {
      const nodeId = block.input?.nodeId
      if (typeof nodeId === 'string' && byEncodedId.has(nodeId)) {
        return {
          type: 'open',
          nodeId: byEncodedId.get(nodeId).originalId,
          assistantBlocks: blocks
        }
      }
    }

    if (block.name === ASK_TOOL_NAME) {
      const input = block.input || {}
      const rawOptions = Array.isArray(input.options) ? input.options : []
      const options = []
      const seen = new Set()
      for (const opt of rawOptions) {
        const encoded = typeof opt?.nodeId === 'string' ? opt.nodeId : null
        if (!encoded) continue
        const candidate = byEncodedId.get(encoded)
        if (!candidate) continue
        if (seen.has(candidate.originalId)) continue
        seen.add(candidate.originalId)
        options.push({
          nodeId: candidate.originalId,
          // Use the canonical candidate label, not the model's input field, so
          // chips and the label-word shortcut stay anchored to real notes even
          // if the model paraphrases.
          label: typeof candidate.label === 'string' ? candidate.label : ''
        })
      }
      if (options.length < 2 || options.length > 3) continue
      return {
        type: 'ask',
        toolUseId: typeof block.id === 'string' ? block.id : null,
        question: typeof input.question === 'string' ? input.question : '',
        options,
        assistantBlocks: blocks
      }
    }
  }

  return null
}

import { searchNotes } from './voice-search.js'

const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-6'
const ANTHROPIC_VERSION = '2023-06-01'
const TOOL_NAME = 'open_note'
const MAX_TOKENS = 256
const SEARCH_LIMIT = 8
const REQUEST_TIMEOUT_MS = 8000
const SYSTEM_PROMPT = [
  'You help a user navigate a small knowledge graph by voice.',
  'You receive the spoken request and a JSON list of candidate notes: id, label, snippet (excerpt of the note body), and modified (file last-modified time as epoch milliseconds; larger = more recent).',
  'Call the open_note tool only when one candidate is clearly the best match for the request based on its label or snippet. Do not call the tool for weak or incidental matches.',
  'If two or more candidates fit equally well, pick the one that was most recently modified (the candidate with the highest modified value). This is a tie-breaker by recency, not by file size.',
  'If no candidate clearly fits the request, do not call the tool.'
].join(' ')

export async function resolveNoteByIntent(command, nodes, { apiKey } = {}) {
  if (typeof command !== 'string' || !command.trim()) return null
  if (typeof apiKey !== 'string' || !apiKey) return null

  const searchResults = searchNotes(command, nodes, { limit: SEARCH_LIMIT })
  if (searchResults.length === 0) return null

  const candidates = encodeCandidates(searchResults)

  const response = await sendMessagesRequest(command.trim(), candidates, apiKey)
  if (!response) return null

  return pickToolUseNodeId(response, candidates)
}

function encodeCandidates(searchResults) {
  const stringIdsInUse = new Set()
  const candidates = []

  for (const result of searchResults) {
    // Mixed-type ids (e.g. 1 and '1') would collapse on String() alone;
    // suffix collisions so both stay distinct in the tool enum.
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

async function sendMessagesRequest(command, candidates, apiKey) {
  const ids = candidates.map(candidate => candidate.id)
  const promptCandidates = candidates.map(({ id, label, snippet, modified }) => ({
    id, label, snippet, modified
  }))
  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tool_choice: { type: 'auto' },
    messages: [{
      role: 'user',
      content: `Request: ${command}\n\nCandidate notes:\n${JSON.stringify(promptCandidates, null, 2)}`
    }],
    tools: [{
      name: TOOL_NAME,
      description: 'Open the candidate note that best matches the spoken request.',
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
    }]
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

function pickToolUseNodeId(response, candidates) {
  const blocks = Array.isArray(response?.content) ? response.content : []
  const byStringId = new Map(candidates.map(candidate => [candidate.id, candidate.originalId]))

  for (const block of blocks) {
    if (block?.type !== 'tool_use' || block.name !== TOOL_NAME) continue
    const nodeId = block.input?.nodeId
    if (typeof nodeId === 'string' && byStringId.has(nodeId)) {
      return byStringId.get(nodeId)
    }
  }

  return null
}

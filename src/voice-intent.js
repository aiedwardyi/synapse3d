const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-6'
const ANTHROPIC_VERSION = '2023-06-01'
const TOOL_NAME = 'open_note'
const MAX_TOKENS = 256
const MAX_CANDIDATES = 200
const REQUEST_TIMEOUT_MS = 8000
const SYSTEM_PROMPT = [
  'You help a user navigate a small knowledge graph by voice.',
  'You will receive the spoken request and a JSON list of available notes (id and label).',
  'Call the open_note tool only when one note is clearly the best match for the request.',
  'If no note fits, do not call the tool.'
].join(' ')

export async function resolveNoteByIntent(command, nodes, { apiKey } = {}) {
  if (typeof command !== 'string' || !command.trim()) return null
  if (typeof apiKey !== 'string' || !apiKey) return null

  const candidates = buildCandidates(nodes)
  if (candidates.length === 0) return null

  const response = await sendMessagesRequest(command.trim(), candidates, apiKey)
  if (!response) return null

  return pickToolUseNodeId(response, candidates)
}

function buildCandidates(nodes) {
  if (!Array.isArray(nodes)) return []
  const seen = new Set()
  const candidates = []

  for (const node of nodes) {
    if (!node || node.missing || node.id == null) continue
    const id = String(node.id)
    if (seen.has(id)) continue
    seen.add(id)

    const label = typeof node.label === 'string' && node.label.trim() ? node.label : id
    candidates.push({ id, label, originalId: node.id })

    if (candidates.length >= MAX_CANDIDATES) break
  }

  return candidates
}

async function sendMessagesRequest(command, candidates, apiKey) {
  const ids = candidates.map(candidate => candidate.id)
  const promptCandidates = candidates.map(({ id, label }) => ({ id, label }))
  const body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    tool_choice: { type: 'auto' },
    messages: [{
      role: 'user',
      content: `Request: ${command}\n\nAvailable notes:\n${JSON.stringify(promptCandidates, null, 2)}`
    }],
    tools: [{
      name: TOOL_NAME,
      description: 'Open the note that best matches the spoken request.',
      input_schema: {
        type: 'object',
        properties: {
          nodeId: {
            type: 'string',
            enum: ids,
            description: 'The id of the note to open.'
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

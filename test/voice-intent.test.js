import assert from 'node:assert/strict'
import { afterEach, test, mock } from 'node:test'
import { warmUpIntent, withCandidateCacheBreakpoint } from '../src/voice-intent.js'
import { CANDIDATES_HEADER } from '../src/voice-message-format.js'

const originalFetch = globalThis.fetch
const flush = () => new Promise(resolve => setImmediate(resolve))

afterEach(() => {
  globalThis.fetch = originalFetch
})

test('withCandidateCacheBreakpoint splits the candidate list into a cached block', () => {
  const messages = [
    {
      role: 'user',
      content: 'Request: alpha\n\nCandidate notes:\n[{"id":"a","label":"Alpha"}]'
    }
  ]

  const out = withCandidateCacheBreakpoint(messages)
  assert.equal(out.length, 1)

  const blocks = out[0].content
  assert.equal(out[0].role, 'user')
  assert.equal(Array.isArray(blocks), true)
  assert.equal(blocks.length, 2)

  assert.deepEqual(blocks[0], { type: 'text', text: 'Request: alpha' })
  assert.equal(blocks[1].type, 'text')
  assert.equal(blocks[1].text.startsWith(CANDIDATES_HEADER), true)
  assert.deepEqual(blocks[1].cache_control, { type: 'ephemeral' })
})

test('withCandidateCacheBreakpoint preserves later messages unchanged', () => {
  const followup = { role: 'assistant', content: [{ type: 'text', text: 'ok' }] }
  const messages = [
    { role: 'user', content: 'Request: a\n\nCandidate notes:\n[]' },
    followup
  ]

  const out = withCandidateCacheBreakpoint(messages)
  assert.equal(out.length, 2)
  assert.equal(out[1], followup)
})

test('withCandidateCacheBreakpoint preserves extra fields on the first message', () => {
  const messages = [
    {
      role: 'user',
      id: 'msg-1',
      content: 'Request: a\n\nCandidate notes:\n[]'
    }
  ]

  const out = withCandidateCacheBreakpoint(messages)
  assert.equal(out[0].id, 'msg-1')
})

test('withCandidateCacheBreakpoint returns input unchanged when the header is missing', () => {
  const messages = [{ role: 'user', content: 'Just a plain request, no candidates section.' }]

  const out = withCandidateCacheBreakpoint(messages)
  assert.equal(out, messages)
})

test('withCandidateCacheBreakpoint returns input unchanged when request text would be empty', () => {
  const messages = [{ role: 'user', content: 'Candidate notes:\n[]' }]

  const out = withCandidateCacheBreakpoint(messages)
  assert.equal(out, messages)
})

test('withCandidateCacheBreakpoint returns input unchanged when content is not a string', () => {
  const messages = [
    {
      role: 'user',
      content: [{ type: 'text', text: 'already a block' }]
    }
  ]

  const out = withCandidateCacheBreakpoint(messages)
  assert.equal(out, messages)
})

test('withCandidateCacheBreakpoint tolerates empty or non-array input', () => {
  assert.deepEqual(withCandidateCacheBreakpoint([]), [])
  assert.equal(withCandidateCacheBreakpoint(null), null)
  assert.equal(withCandidateCacheBreakpoint(undefined), undefined)
})

test('warmUpIntent issues a request to the messages endpoint when an api key is present', async () => {
  globalThis.fetch = mock.fn(async () => ({ ok: true, json: async () => ({}) }))

  warmUpIntent({ apiKey: 'sk-test' })

  assert.equal(globalThis.fetch.mock.calls.length, 1)
  const [url, options] = globalThis.fetch.mock.calls[0].arguments
  assert.equal(url, 'https://api.anthropic.com/v1/messages')
  assert.equal(JSON.parse(options.body).model, 'claude-haiku-4-5')

  await flush()
})

test('warmUpIntent issues no request when no api key is configured', () => {
  globalThis.fetch = mock.fn()

  warmUpIntent()
  warmUpIntent({})
  warmUpIntent({ apiKey: '' })

  assert.equal(globalThis.fetch.mock.calls.length, 0)
})

test('warmUpIntent does not throw when the request rejects', async () => {
  globalThis.fetch = mock.fn(() => Promise.reject(new Error('network down')))

  assert.doesNotThrow(() => warmUpIntent({ apiKey: 'sk-test' }))

  await flush()
})

test('warmUpIntent returns without awaiting the request', async () => {
  let settle
  globalThis.fetch = mock.fn(() => new Promise(resolve => { settle = resolve }))

  const result = warmUpIntent({ apiKey: 'sk-test' })

  assert.equal(result, undefined)
  assert.equal(globalThis.fetch.mock.calls.length, 1)

  // Settle so the request's abort timer clears and the suite does not hang.
  settle({ ok: true, json: async () => ({}) })
  await flush()
})

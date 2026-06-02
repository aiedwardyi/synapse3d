import assert from 'node:assert/strict'
import { test } from 'node:test'
import { withCandidateCacheBreakpoint } from '../src/voice-intent.js'

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
  assert.equal(blocks[1].text.startsWith('Candidate notes:\n'), true)
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

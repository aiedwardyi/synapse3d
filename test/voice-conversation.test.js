import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  startConversation,
  applyResponse,
  applyAnswer,
  abort,
  isStale,
  isTerminal
} from '../src/voice-conversation.js'

function cand(overrides) {
  return {
    id: overrides.id,
    originalId: overrides.originalId ?? overrides.id,
    label: overrides.label,
    snippet: overrides.snippet ?? '',
    modified: overrides.modified ?? 0
  }
}

const C_RECENT = cand({ id: 'precision', label: 'Precision Note', modified: 5000 })
const C_OLDER = cand({ id: 'optimizer', label: 'Optimizer Note', modified: 1000 })

function askResponse(toolUseId, options, question = 'Which one?') {
  return {
    type: 'ask',
    toolUseId,
    question,
    options,
    assistantBlocks: [{
      type: 'tool_use',
      id: toolUseId,
      name: 'ask_clarification',
      input: { question, options }
    }]
  }
}

test('startConversation builds initial user message and pending_api phase', () => {
  const state = startConversation({
    command: 'open the precision note',
    candidates: [C_RECENT, C_OLDER],
    graphVersion: 7
  })

  assert.equal(state.phase, 'pending_api')
  assert.equal(state.graphVersion, 7)
  assert.equal(state.rounds, 0)
  assert.equal(state.maxRounds, 2)
  assert.equal(state.askMeta, null)
  assert.equal(state.result, null)
  assert.equal(state.reason, null)
  assert.equal(state.messages.length, 1)
  assert.equal(state.messages[0].role, 'user')
  assert.ok(typeof state.messages[0].content === 'string')
  assert.ok(state.messages[0].content.includes('precision note'))
  assert.ok(state.messages[0].content.includes('Precision Note'))
})

test('startConversation preserves the trimmed command on state for later status text', () => {
  const state = startConversation({
    command: '  open the precision note  ',
    candidates: [C_RECENT],
    graphVersion: 1
  })
  assert.equal(state.command, 'open the precision note')
})

test('startConversation accepts a custom maxRounds', () => {
  const state = startConversation({
    command: 'x', candidates: [C_RECENT], graphVersion: 1, maxRounds: 5
  })
  assert.equal(state.maxRounds, 5)
})

test('applyResponse open resolves with nodeId and freezes state', () => {
  let state = startConversation({ command: 'x', candidates: [C_RECENT], graphVersion: 1 })
  state = applyResponse(state, { type: 'open', nodeId: 'precision', assistantBlocks: [] })

  assert.equal(state.phase, 'resolved')
  assert.equal(state.result.nodeId, 'precision')
  assert.equal(isTerminal(state), true)
})

test('applyResponse ask transitions to pending_user with askMeta and assistant message', () => {
  let state = startConversation({ command: 'x', candidates: [C_RECENT, C_OLDER], graphVersion: 1 })
  state = applyResponse(state, askResponse('toolu_1', [
    { nodeId: 'precision', label: 'Precision Note' },
    { nodeId: 'optimizer', label: 'Optimizer Note' }
  ], 'Which one?'))

  assert.equal(state.phase, 'pending_user')
  assert.equal(state.askMeta.toolUseId, 'toolu_1')
  assert.equal(state.askMeta.question, 'Which one?')
  assert.equal(state.askMeta.options.length, 2)
  assert.equal(state.messages.length, 2)
  assert.equal(state.messages[1].role, 'assistant')
  assert.ok(Array.isArray(state.messages[1].content))
})

test('applyResponse null aborts with reason no_match', () => {
  let state = startConversation({ command: 'x', candidates: [C_RECENT], graphVersion: 1 })
  state = applyResponse(state, null)
  assert.equal(state.phase, 'aborted')
  assert.equal(state.reason, 'no_match')
})

test('applyResponse with malformed ask aborts with no_match', () => {
  let state = startConversation({ command: 'x', candidates: [C_RECENT], graphVersion: 1 })
  state = applyResponse(state, { type: 'ask' })
  assert.equal(state.phase, 'aborted')
})

test('full flow: start → ask → answer "the recent one" → resolved by most-recent', () => {
  let state = startConversation({ command: 'open note', candidates: [C_RECENT, C_OLDER], graphVersion: 1 })
  state = applyResponse(state, askResponse('t1', [
    { nodeId: 'precision', label: 'Precision Note' },
    { nodeId: 'optimizer', label: 'Optimizer Note' }
  ]))
  state = applyAnswer(state, 'the recent one')

  assert.equal(state.phase, 'resolved')
  assert.equal(state.result.nodeId, 'precision')
})

test('"most recent" picks max modified across phrasings', () => {
  for (const phrase of ['recent', 'newest', 'latest', 'the most recent', 'the newer one', 'most recent']) {
    let state = startConversation({ command: 'x', candidates: [C_RECENT, C_OLDER], graphVersion: 1 })
    state = applyResponse(state, askResponse('t', [
      { nodeId: 'precision', label: 'A' },
      { nodeId: 'optimizer', label: 'B' }
    ]))
    state = applyAnswer(state, phrase)
    assert.equal(state.phase, 'resolved', `phrase: "${phrase}"`)
    assert.equal(state.result.nodeId, 'precision', `phrase: "${phrase}"`)
  }
})

test('unique label word resolves answer', () => {
  let state = startConversation({ command: 'x', candidates: [C_RECENT, C_OLDER], graphVersion: 1 })
  state = applyResponse(state, askResponse('t', [
    { nodeId: 'precision', label: 'Precision Note' },
    { nodeId: 'optimizer', label: 'Optimizer Note' }
  ]))
  state = applyAnswer(state, 'the optimizer one')

  assert.equal(state.phase, 'resolved')
  assert.equal(state.result.nodeId, 'optimizer')
})

test('label match takes precedence over recency', () => {
  // precision is the most recent; user says "optimizer" plus "recent"
  let state = startConversation({ command: 'x', candidates: [C_RECENT, C_OLDER], graphVersion: 1 })
  state = applyResponse(state, askResponse('t', [
    { nodeId: 'precision', label: 'Precision Note' },
    { nodeId: 'optimizer', label: 'Optimizer Note' }
  ]))
  state = applyAnswer(state, 'the recent optimizer')

  assert.equal(state.phase, 'resolved')
  assert.equal(state.result.nodeId, 'optimizer')
})

test('shared label words do not disambiguate, falls through to continue', () => {
  const cA = cand({ id: 'a', label: 'BF16 Precision' })
  const cB = cand({ id: 'b', label: 'BF16 Optimizer' })
  let state = startConversation({ command: 'x', candidates: [cA, cB], graphVersion: 1 })
  state = applyResponse(state, askResponse('t', [
    { nodeId: 'a', label: 'BF16 Precision' },
    { nodeId: 'b', label: 'BF16 Optimizer' }
  ]))
  state = applyAnswer(state, 'bf16')

  assert.equal(state.phase, 'pending_api')
  assert.equal(state.rounds, 1)
})

test('applyAnswer with no shortcut continues to pending_api with tool_result message', () => {
  let state = startConversation({ command: 'x', candidates: [C_RECENT, C_OLDER], graphVersion: 1 })
  state = applyResponse(state, askResponse('toolu_first', [
    { nodeId: 'precision', label: 'A' },
    { nodeId: 'optimizer', label: 'B' }
  ]))
  state = applyAnswer(state, 'I have no idea')

  assert.equal(state.phase, 'pending_api')
  assert.equal(state.rounds, 1)

  const last = state.messages[state.messages.length - 1]
  assert.equal(last.role, 'user')
  assert.ok(Array.isArray(last.content))
  assert.equal(last.content[0].type, 'tool_result')
  assert.equal(last.content[0].tool_use_id, 'toolu_first')
  assert.equal(last.content[0].content, 'I have no idea')
})

test('applyAnswer aborts when the 2nd answer fails to resolve (round cap)', () => {
  let state = startConversation({
    command: 'x', candidates: [C_RECENT, C_OLDER], graphVersion: 1, maxRounds: 2
  })
  state = applyResponse(state, askResponse('t1', [
    { nodeId: 'precision', label: 'A' },
    { nodeId: 'optimizer', label: 'B' }
  ]))
  state = applyAnswer(state, 'no idea')
  assert.equal(state.phase, 'pending_api')

  state = applyResponse(state, askResponse('t2', [
    { nodeId: 'precision', label: 'A' },
    { nodeId: 'optimizer', label: 'B' }
  ]))
  state = applyAnswer(state, 'still no idea')

  assert.equal(state.phase, 'aborted')
  assert.equal(state.reason, 'round_cap')
})

test('isStale detects graph version changes in either direction', () => {
  const state = startConversation({ command: 'x', candidates: [C_RECENT], graphVersion: 5 })
  assert.equal(isStale(state, 5), false)
  assert.equal(isStale(state, 6), true)
  assert.equal(isStale(state, 4), true)
})

test('abort transitions to aborted with the given reason (e.g. timeout)', () => {
  let state = startConversation({ command: 'x', candidates: [C_RECENT], graphVersion: 1 })
  state = applyResponse(state, askResponse('t', [
    { nodeId: 'precision', label: 'A' }
  ]))
  state = abort(state, 'timeout')

  assert.equal(state.phase, 'aborted')
  assert.equal(state.reason, 'timeout')
})

test('applyAnswer is a no-op when not in pending_user phase', () => {
  const state = startConversation({ command: 'x', candidates: [C_RECENT], graphVersion: 1 })
  const next = applyAnswer(state, 'anything')
  assert.equal(next, state)
})

test('applyResponse is a no-op once resolved', () => {
  let state = startConversation({ command: 'x', candidates: [C_RECENT], graphVersion: 1 })
  state = applyResponse(state, { type: 'open', nodeId: 'precision', assistantBlocks: [] })
  const after = applyResponse(state, { type: 'open', nodeId: 'optimizer', assistantBlocks: [] })
  assert.equal(after.result.nodeId, 'precision')
})

test('abort is a no-op once already terminal', () => {
  let state = startConversation({ command: 'x', candidates: [C_RECENT], graphVersion: 1 })
  state = applyResponse(state, { type: 'open', nodeId: 'precision', assistantBlocks: [] })
  const after = abort(state, 'timeout')
  assert.equal(after.phase, 'resolved')
  assert.equal(after.reason, null)
})

test('isTerminal recognises resolved and aborted', () => {
  let state = startConversation({ command: 'x', candidates: [C_RECENT], graphVersion: 1 })
  assert.equal(isTerminal(state), false)
  state = applyResponse(state, { type: 'open', nodeId: 'precision', assistantBlocks: [] })
  assert.equal(isTerminal(state), true)

  let abortedState = startConversation({ command: 'x', candidates: [C_RECENT], graphVersion: 1 })
  abortedState = abort(abortedState, 'timeout')
  assert.equal(isTerminal(abortedState), true)
})

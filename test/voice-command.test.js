import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  extractDirectCommand,
  extractWakeCommand,
  matchNoteCommand
} from '../src/voice-command.js'

test('extractWakeCommand returns text after wake word', () => {
  assert.equal(extractWakeCommand('claude open alpha'), 'open alpha')
})

test('extractWakeCommand returns null when wake word absent', () => {
  assert.equal(extractWakeCommand('please open alpha'), null)
})

test('extractWakeCommand accepts fuzzy variants of the wake word', () => {
  assert.equal(extractWakeCommand('cloud open alpha'), 'open alpha')
  assert.equal(extractWakeCommand('claud open alpha'), 'open alpha')
  assert.equal(extractWakeCommand('clod open alpha'), 'open alpha')
})

test('extractWakeCommand strips punctuation around the wake word', () => {
  assert.equal(extractWakeCommand('Claude, open alpha.'), 'open alpha')
})

test('extractWakeCommand is case insensitive', () => {
  assert.equal(extractWakeCommand('CLAUDE Open Alpha'), 'open alpha')
})

test('extractWakeCommand returns empty string when wake word has no trailing text', () => {
  assert.equal(extractWakeCommand('hey claude'), '')
})

test('extractWakeCommand returns null for non-string input', () => {
  assert.equal(extractWakeCommand(undefined), null)
  assert.equal(extractWakeCommand(null), null)
  assert.equal(extractWakeCommand(42), null)
})

test('extractWakeCommand returns null for empty or whitespace transcript', () => {
  assert.equal(extractWakeCommand(''), null)
  assert.equal(extractWakeCommand('   '), null)
})

test('extractWakeCommand honours a custom wake word list', () => {
  assert.equal(
    extractWakeCommand('jarvis open alpha', { wakeWords: ['jarvis'] }),
    'open alpha'
  )
  assert.equal(
    extractWakeCommand('claude open alpha', { wakeWords: ['jarvis'] }),
    null
  )
})

test('matchNoteCommand finds an exact label match', () => {
  const nodes = [
    { id: 'a', label: 'Alpha' },
    { id: 'b', label: 'Beta' }
  ]

  assert.deepEqual(matchNoteCommand('alpha', nodes), {
    nodeId: 'a',
    label: 'Alpha',
    matchType: 'exact'
  })
})

test('matchNoteCommand is case insensitive', () => {
  const nodes = [{ id: 'a', label: 'Alpha' }]

  assert.deepEqual(matchNoteCommand('ALPHA', nodes), {
    nodeId: 'a',
    label: 'Alpha',
    matchType: 'exact'
  })
})

test('matchNoteCommand falls back to substring matches', () => {
  const nodes = [{ id: 'a', label: 'Alpha Notes' }]

  const result = matchNoteCommand('alpha', nodes)
  assert.equal(result.nodeId, 'a')
  assert.equal(result.matchType, 'substring')
})

test('matchNoteCommand falls back to all-words-present matches', () => {
  const nodes = [{ id: 'a', label: 'Alpha Beta Gamma' }]

  const result = matchNoteCommand('gamma alpha', nodes)
  assert.equal(result.nodeId, 'a')
  assert.equal(result.matchType, 'all-words')
})

test('matchNoteCommand strips leading command verbs', () => {
  const nodes = [{ id: 'a', label: 'Alpha' }]

  assert.equal(matchNoteCommand('open alpha', nodes).nodeId, 'a')
  assert.equal(matchNoteCommand('read alpha', nodes).nodeId, 'a')
  assert.equal(matchNoteCommand('show alpha', nodes).nodeId, 'a')
  assert.equal(matchNoteCommand('show me alpha', nodes).nodeId, 'a')
  assert.equal(matchNoteCommand('go to alpha', nodes).nodeId, 'a')
})

test('matchNoteCommand returns null when the command is only a verb', () => {
  const nodes = [{ id: 'a', label: 'Alpha' }]

  assert.equal(matchNoteCommand('open', nodes), null)
  assert.equal(matchNoteCommand('show me', nodes), null)
})

test('matchNoteCommand returns null for an empty command', () => {
  const nodes = [{ id: 'a', label: 'Alpha' }]

  assert.equal(matchNoteCommand('', nodes), null)
  assert.equal(matchNoteCommand('   ', nodes), null)
})

test('matchNoteCommand excludes missing nodes', () => {
  const nodes = [
    { id: 'a', label: 'Alpha', missing: true },
    { id: 'b', label: 'Beta' }
  ]

  assert.equal(matchNoteCommand('alpha', nodes), null)
})

test('matchNoteCommand falls back to id when label is missing', () => {
  const nodes = [{ id: 'alpha' }]

  const result = matchNoteCommand('alpha', nodes)
  assert.equal(result.nodeId, 'alpha')
  assert.equal(result.matchType, 'exact')
})

test('matchNoteCommand prefers exact over substring matches', () => {
  const nodes = [
    { id: 'long', label: 'Alpha Notes' },
    { id: 'short', label: 'Alpha' }
  ]

  const result = matchNoteCommand('alpha', nodes)
  assert.equal(result.nodeId, 'short')
  assert.equal(result.matchType, 'exact')
})

test('matchNoteCommand breaks ties by shortest label', () => {
  const nodes = [
    { id: 'long', label: 'Graph Theory Notes' },
    { id: 'short', label: 'Graph Notes' }
  ]

  const result = matchNoteCommand('graph', nodes)
  assert.equal(result.nodeId, 'short')
})

test('matchNoteCommand returns null when no node matches', () => {
  const nodes = [{ id: 'a', label: 'Alpha' }]

  assert.equal(matchNoteCommand('zeta', nodes), null)
})

test('matchNoteCommand requires substring to start at a word boundary', () => {
  // "rust" must not match "Trust" and "net" must not match "Internet".
  assert.equal(matchNoteCommand('rust', [{ id: 'a', label: 'Trust Fund' }]), null)
  assert.equal(matchNoteCommand('net', [{ id: 'a', label: 'Internet Notes' }]), null)
})

test('matchNoteCommand matches prefix of a label word', () => {
  // "alph" should still match "Alpha" because the query starts at the word boundary.
  const nodes = [{ id: 'a', label: 'Alpha' }]
  const result = matchNoteCommand('alph', nodes)
  assert.equal(result?.nodeId, 'a')
  assert.equal(result?.matchType, 'substring')
})

test('matchNoteCommand handles empty or missing node list', () => {
  assert.equal(matchNoteCommand('alpha', []), null)
  assert.equal(matchNoteCommand('alpha', null), null)
  assert.equal(matchNoteCommand('alpha', undefined), null)
})

test('extractDirectCommand accepts transcripts that start with a command verb', () => {
  assert.equal(extractDirectCommand('open alpha'), 'open alpha')
  assert.equal(extractDirectCommand('READ Alpha'), 'read alpha')
  assert.equal(extractDirectCommand('show alpha'), 'show alpha')
  assert.equal(extractDirectCommand('show me alpha'), 'show me alpha')
  assert.equal(extractDirectCommand('go to alpha'), 'go to alpha')
})

test('extractDirectCommand returns null for verb-only transcripts', () => {
  assert.equal(extractDirectCommand('open'), null)
  assert.equal(extractDirectCommand('show me'), null)
  assert.equal(extractDirectCommand('go to'), null)
})

test('extractDirectCommand returns null for non-command transcripts', () => {
  assert.equal(extractDirectCommand('hello there'), null)
  assert.equal(extractDirectCommand('thats interesting'), null)
  assert.equal(extractDirectCommand(''), null)
  assert.equal(extractDirectCommand(undefined), null)
})

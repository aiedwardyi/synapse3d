import assert from 'node:assert/strict'
import { test } from 'node:test'
import { searchNotes } from '../src/voice-search.js'

function node(overrides) {
  return {
    id: 'id',
    label: 'Label',
    content: '',
    tags: [],
    modified: 0,
    missing: false,
    ...overrides
  }
}

test('returns empty array for empty query', () => {
  const nodes = [node({ id: 'a', label: 'Alpha' })]
  assert.deepEqual(searchNotes('', nodes), [])
  assert.deepEqual(searchNotes('   ', nodes), [])
})

test('returns empty array for empty or missing node list', () => {
  assert.deepEqual(searchNotes('alpha', []), [])
  assert.deepEqual(searchNotes('alpha', null), [])
  assert.deepEqual(searchNotes('alpha', undefined), [])
})

test('excludes missing nodes', () => {
  const nodes = [
    node({ id: 'a', label: 'Alpha', missing: true }),
    node({ id: 'b', label: 'Beta', content: 'alpha appears in body' })
  ]
  const results = searchNotes('alpha', nodes)
  assert.equal(results.length, 1)
  assert.equal(results[0].id, 'b')
})

test('label match outranks body match for the same query', () => {
  const nodes = [
    node({ id: 'body', label: 'Other', content: 'entropy and entropy again' }),
    node({ id: 'label', label: 'Entropy Notes', content: 'unrelated' })
  ]
  const results = searchNotes('entropy', nodes)
  assert.equal(results[0].id, 'label')
})

test('tag match outranks body match for the same query', () => {
  const nodes = [
    node({ id: 'body', label: 'Note A', content: 'physics physics physics' }),
    node({ id: 'tag', label: 'Note B', tags: ['physics'] })
  ]
  const results = searchNotes('physics', nodes)
  assert.equal(results[0].id, 'tag')
})

test('multi-term query sums hits across fields', () => {
  const nodes = [
    node({ id: 'one', label: 'Quantum', content: 'mechanics mechanics' }),
    node({ id: 'two', label: 'Note', content: 'unrelated text' })
  ]
  const results = searchNotes('quantum mechanics', nodes)
  assert.equal(results[0].id, 'one')
})

test('breaks score ties by modified desc (most recent first)', () => {
  const nodes = [
    node({ id: 'old', label: 'Topic', modified: 1000 }),
    node({ id: 'new', label: 'Topic', modified: 5000 })
  ]
  const results = searchNotes('topic', nodes)
  assert.deepEqual(results.map(r => r.id), ['new', 'old'])
})

test('returns a snippet excerpt around the body hit', () => {
  const content = 'Lorem ipsum dolor sit amet, the keyword sits here in the middle, and then more text follows for context.'
  const nodes = [node({ id: 'a', label: 'Other', content })]
  const [result] = searchNotes('keyword', nodes)
  assert.ok(result.snippet.includes('keyword'))
  assert.ok(result.snippet.length <= 200)
  assert.ok(result.snippet.length > 0)
})

test('returns empty snippet when only label or tag matches and body has no hit', () => {
  const nodes = [node({ id: 'a', label: 'Entropy', content: 'no relevant body text here' })]
  const [result] = searchNotes('entropy', nodes)
  assert.equal(result.snippet, '')
})

test('respects the limit option', () => {
  const nodes = Array.from({ length: 20 }, (_, i) => node({ id: `n${i}`, label: 'Topic' }))
  const results = searchNotes('topic', nodes, { limit: 3 })
  assert.equal(results.length, 3)
})

test('default limit is 8', () => {
  const nodes = Array.from({ length: 20 }, (_, i) => node({ id: `n${i}`, label: 'Topic' }))
  const results = searchNotes('topic', nodes)
  assert.equal(results.length, 8)
})

test('returned shape is { id, label, snippet, modified }', () => {
  const nodes = [node({ id: 'a', label: 'Alpha', content: 'hello alpha world', modified: 1234 })]
  const [result] = searchNotes('alpha', nodes)
  assert.deepEqual(Object.keys(result).sort(), ['id', 'label', 'modified', 'snippet'])
  assert.equal(result.id, 'a')
  assert.equal(result.label, 'Alpha')
  assert.equal(result.modified, 1234)
})

test('strips command verbs from the query before scoring', () => {
  const nodes = [node({ id: 'a', label: 'Alpha' })]
  const results = searchNotes('open alpha', nodes)
  assert.equal(results.length, 1)
  assert.equal(results[0].id, 'a')
})

test('returns empty when only command verbs are provided', () => {
  const nodes = [node({ id: 'a', label: 'Alpha' })]
  assert.deepEqual(searchNotes('open', nodes), [])
  assert.deepEqual(searchNotes('show me', nodes), [])
})

test('is case insensitive', () => {
  const nodes = [node({ id: 'a', label: 'Alpha', content: 'Quantum Mechanics' })]
  const results = searchNotes('QUANTUM', nodes)
  assert.equal(results.length, 1)
  assert.equal(results[0].id, 'a')
})

test('does not mutate the input nodes', () => {
  const original = node({ id: 'a', label: 'Alpha', content: 'hello', tags: ['x'], modified: 99 })
  const snapshot = JSON.parse(JSON.stringify(original))
  searchNotes('alpha', [original])
  assert.deepEqual(original, snapshot)
})

test('omits nodes with zero score', () => {
  const nodes = [
    node({ id: 'match', label: 'Alpha' }),
    node({ id: 'nomatch', label: 'Beta', content: 'unrelated' })
  ]
  const results = searchNotes('alpha', nodes)
  assert.equal(results.length, 1)
  assert.equal(results[0].id, 'match')
})

test('filters stopwords so short labels beat noisy bodies', () => {
  const nodes = [
    node({ id: 'target', label: 'Determinism and Precision' }),
    node({ id: 'noisy', label: 'Other', content: ('and '.repeat(100)) + 'file file' })
  ]
  const results = searchNotes('open determinism and precision file', nodes)
  assert.equal(results[0].id, 'target')
})

test('returns empty when query is only stopwords', () => {
  const nodes = [node({ id: 'a', label: 'Alpha' })]
  assert.deepEqual(searchNotes('the file', nodes), [])
  assert.deepEqual(searchNotes('open the file', nodes), [])
})

test('matches terms ending in non-word characters like 85%', () => {
  const nodes = [
    node({ id: 'a', label: 'Stats', content: 'we got 85% on the test' }),
    node({ id: 'b', label: 'Other', content: 'page 85-A reference' })
  ]
  const results = searchNotes('85%', nodes)
  assert.equal(results[0].id, 'a')
})

test('matches body terms with underscores in the source', () => {
  const nodes = [
    node({ id: 'a', label: 'Other', content: 'see also determinism_and_precision below' })
  ]
  const results = searchNotes('determinism precision', nodes)
  assert.equal(results.length, 1)
  assert.equal(results[0].id, 'a')
})

test('deduplicates nodes that share an id', () => {
  const dup1 = node({ id: 'dup', label: 'Alpha' })
  const dup2 = node({ id: 'dup', label: 'Alpha (copy)' })
  const results = searchNotes('alpha', [dup1, dup2])
  assert.equal(results.length, 1)
  assert.equal(results[0].id, 'dup')
})

test('keeps a later duplicate when the earlier one scores zero', () => {
  const zeroScoreFirst = node({ id: 'dup', label: 'Other' })
  const positiveSecond = node({ id: 'dup', label: 'Alpha' })
  const results = searchNotes('alpha', [zeroScoreFirst, positiveSecond])
  assert.equal(results.length, 1)
  assert.equal(results[0].label, 'Alpha')
})

test('matches a note whose label is entirely a stopword like "Notes"', () => {
  const nodes = [node({ id: 'a', label: 'Notes' })]
  const results = searchNotes('open notes', nodes)
  assert.equal(results.length, 1)
  assert.equal(results[0].id, 'a')
})

test('treats non-ASCII letters as word characters (no false substring match)', () => {
  const nodes = [node({ id: 'a', label: 'Other', content: 'wrote a résumé yesterday' })]
  // "sumé" must NOT match inside "résumé"; the é is a letter, not a boundary.
  assert.deepEqual(searchNotes('sumé', nodes), [])
})

test('matches an exact non-ASCII term in body', () => {
  const nodes = [node({ id: 'a', label: 'Other', content: 'wrote a résumé yesterday' })]
  const results = searchNotes('résumé', nodes)
  assert.equal(results.length, 1)
  assert.equal(results[0].id, 'a')
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseVault } from '../src/vault.js'

function fileHandle(name, text, options = {}) {
  return {
    kind: 'file',
    name,
    async getFile() {
      if (options.failRead) throw new Error(`Cannot read ${name}`)
      return {
        async text() {
          if (options.failText) throw new Error(`Cannot read text for ${name}`)
          return text
        }
      }
    }
  }
}

function directoryHandle(name, entries) {
  return {
    kind: 'directory',
    name,
    async *values() {
      for (const entry of entries) {
        yield entry
      }
    }
  }
}

function rootHandle(entries) {
  return directoryHandle('', entries)
}

function linkTarget(result, source) {
  return result.links.find(link => link.source === source)?.target
}

test('resolves extension-qualified and folder-qualified wikilinks to existing notes', async () => {
  const vault = rootHandle([
    fileHandle('Home.md', '[[Folder/Target.md]]'),
    directoryHandle('Folder', [
      fileHandle('Source.md', '[[Target.md]]'),
      fileHandle('Target.md', '#project')
    ])
  ])

  const result = await parseVault(vault)

  assert.equal(linkTarget(result, 'Home.md'), 'Folder/Target.md')
  assert.equal(linkTarget(result, 'Folder/Source.md'), 'Folder/Target.md')
  assert.equal(result.stats.brokenLinks, 0)
})

test('prefers same-folder duplicate basenames and marks ambiguous bare links', async () => {
  const vault = rootHandle([
    fileHandle('Root.md', '[[Topic]]'),
    directoryHandle('A', [
      fileHandle('Source.md', '[[Topic]]'),
      fileHandle('Topic.md', '')
    ]),
    directoryHandle('B', [
      fileHandle('Topic.md', '')
    ])
  ])

  const result = await parseVault(vault)
  const ambiguousNode = result.nodes.find(node => node.label === 'Topic' && node.missing)

  assert.equal(linkTarget(result, 'A/Source.md'), 'A/Topic.md')
  assert.ok(ambiguousNode)
  assert.equal(linkTarget(result, 'Root.md'), ambiguousNode.id)
  assert.equal(result.stats.ambiguousLinks, 1)
})

test('deduplicates repeated wikilinks from the same source to the same target', async () => {
  const vault = rootHandle([
    fileHandle('Home.md', '[[Target]] and [[Target.md]]'),
    fileHandle('Target.md', '')
  ])

  const result = await parseVault(vault)

  assert.deepEqual(result.links, [{ source: 'Home.md', target: 'Target.md' }])
  assert.equal(result.stats.linksCreated, 1)
})

test('deduplicates equivalent unresolved wikilink placeholders', async () => {
  const vault = rootHandle([
    fileHandle('Home.md', '[[Missing]] and [[Missing.md]]')
  ])

  const result = await parseVault(vault)
  const placeholders = result.nodes.filter(node => node.missing)

  assert.equal(placeholders.length, 1)
  assert.equal(placeholders[0].label, 'Missing')
  assert.deepEqual(result.links, [{ source: 'Home.md', target: placeholders[0].id }])
  assert.equal(result.stats.linksCreated, 1)
})

test('resolves relative path wikilinks from the source folder', async () => {
  const vault = rootHandle([
    directoryHandle('Area', [
      fileHandle('Target.md', '')
    ]),
    directoryHandle('Area/Sub', [
      fileHandle('Source.md', '[[../Target]]')
    ])
  ])

  const result = await parseVault(vault)

  assert.equal(linkTarget(result, 'Area/Sub/Source.md'), 'Area/Target.md')
  assert.equal(result.stats.brokenLinks, 0)
})

test('parses markdown files with case-insensitive extensions', async () => {
  const vault = rootHandle([
    fileHandle('Upper.MD', '[[Mixed.Md]]'),
    fileHandle('Mixed.Md', '')
  ])

  const result = await parseVault(vault)

  assert.deepEqual(
    result.nodes.filter(node => !node.missing).map(node => node.id),
    ['Mixed.Md', 'Upper.MD']
  )
  assert.equal(linkTarget(result, 'Upper.MD'), 'Mixed.Md')
  assert.equal(result.stats.filesScanned, 2)
})

test('records ignored directories separately from scanned files', async () => {
  const vault = rootHandle([
    directoryHandle('.obsidian', [
      fileHandle('workspace.json', '{}')
    ]),
    fileHandle('Visible.md', '')
  ])

  const result = await parseVault(vault)

  assert.equal(result.stats.dirsIgnored, 1)
  assert.equal(result.stats.filesScanned, 1)
  assert.equal(result.nodes.some(node => node.id === '.obsidian/workspace.json'), false)
})

test('extracts header and inline tags with supported characters', async () => {
  const vault = rootHandle([
    fileHandle('Tagged.md', '#Project #team/ai-core\nBody #topic_1 #topic-2 #project #研发 #🔥')
  ])

  const result = await parseVault(vault)
  const node = result.nodes.find(node => node.id === 'Tagged.md')

  assert.deepEqual(node.tags, ['project', 'team/ai-core', 'topic_1', 'topic-2', 'project', '研发', '🔥'])
})

test('creates placeholders and stats for broken wikilinks', async () => {
  const vault = rootHandle([
    fileHandle('Home.md', '[[Missing Note]]')
  ])

  const result = await parseVault(vault)
  const placeholder = result.nodes.find(node => node.missing)

  assert.ok(placeholder)
  assert.equal(placeholder.label, 'Missing Note')
  assert.equal(placeholder.ambiguous, false)
  assert.deepEqual(result.links, [{ source: 'Home.md', target: placeholder.id }])
  assert.equal(result.stats.brokenLinks, 1)
})

test('continues parsing when a markdown file cannot be read', async t => {
  const vault = rootHandle([
    fileHandle('Good.md', '[[Missing]]'),
    fileHandle('Bad.md', '', { failRead: true })
  ])
  const warnings = []

  t.mock.method(console, 'warn', (...args) => warnings.push(args))

  const result = await parseVault(vault)

  assert.equal(result.nodes.some(node => node.id === 'Good.md'), true)
  assert.equal(result.nodes.some(node => node.id === 'Bad.md'), false)
  assert.equal(result.stats.filesScanned, 1)
  assert.equal(result.stats.fileReadErrors, 1)
  assert.equal(warnings.length, 1)
})

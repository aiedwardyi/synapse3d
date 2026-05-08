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

test('continues parsing when a markdown file cannot be read', async () => {
  const vault = rootHandle([
    fileHandle('Good.md', '[[Missing]]'),
    fileHandle('Bad.md', '', { failRead: true })
  ])
  const originalWarn = console.warn
  const warnings = []

  console.warn = (...args) => warnings.push(args)

  let result
  try {
    result = await parseVault(vault)
  } finally {
    console.warn = originalWarn
  }

  assert.equal(result.nodes.some(node => node.id === 'Good.md'), true)
  assert.equal(result.nodes.some(node => node.id === 'Bad.md'), false)
  assert.equal(result.stats.filesScanned, 1)
  assert.equal(result.stats.fileReadErrors, 1)
  assert.equal(warnings.length, 1)
})

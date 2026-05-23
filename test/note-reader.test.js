import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createNoteReader } from '../src/note-reader.js'
import { createSelectionPanel } from '../src/selection-panel.js'

test('openNote renders a known note and marks the reader open', async () => {
  const element = createElement('div')
  const nodes = new Map([
    ['a', { id: 'a', label: 'Alpha', tags: ['topic'], content: '# Alpha\nBody' }]
  ])
  const reader = createNoteReader(element, {
    getNode: id => nodes.get(id) || null,
    getNeighbors: () => []
  })

  const opened = await reader.openNote('a')

  assert.equal(opened, true)
  assert.equal(reader.isOpen(), true)
  assert.equal(element.hidden, false)
  assert.match(element.textContent, /Alpha/)
  assert.match(findByClassName(element, 'note-reader-content').innerHTML, /<h1>Alpha<\/h1>/)
  assert.equal(element.ownerDocument.body.classList.contains('note-reader-open'), true)
})

test('close hides the reader and clears the dimmed background state', async () => {
  const element = createElement('div')
  const reader = createNoteReader(element, {
    getNode: () => ({ id: 'a', label: 'Alpha', tags: [], content: 'Body' }),
    getNeighbors: () => []
  })

  await reader.openNote('a')
  reader.close()

  assert.equal(reader.isOpen(), false)
  assert.equal(element.hidden, true)
  assert.equal(element.ownerDocument.body.classList.contains('note-reader-open'), false)
})

test('next and prev cycle through linked neighbors with wraparound', async () => {
  const element = createElement('div')
  const nodes = new Map([
    ['a', { id: 'a', label: 'Alpha', tags: [], content: 'Root' }],
    ['b', { id: 'b', label: 'Beta', tags: [], content: 'Beta body' }],
    ['c', { id: 'c', label: 'Gamma', tags: [], content: 'Gamma body' }]
  ])
  const reader = createNoteReader(element, {
    getNode: id => nodes.get(id) || null,
    getNeighbors: id => id === 'a' ? [nodes.get('b'), nodes.get('c')] : []
  })

  await reader.openNote('a')
  assert.equal(findByClassName(element, 'note-reader-counter').textContent, 'SOURCE / 2 LINKED')

  await reader.next()
  assert.equal(findByClassName(element, 'note-reader-title').textContent, 'Beta')
  assert.equal(findByClassName(element, 'note-reader-counter').textContent, '1 / 2 LINKED')

  await reader.next()
  assert.equal(findByClassName(element, 'note-reader-title').textContent, 'Gamma')
  assert.equal(findByClassName(element, 'note-reader-counter').textContent, '2 / 2 LINKED')

  await reader.next()
  assert.equal(findByClassName(element, 'note-reader-title').textContent, 'Beta')

  await reader.prev()
  assert.equal(findByClassName(element, 'note-reader-title').textContent, 'Gamma')
})

test('single linked neighbor wraps to itself in both directions', async () => {
  const element = createElement('div')
  const nodes = new Map([
    ['a', { id: 'a', label: 'Alpha', tags: [], content: 'Root' }],
    ['b', { id: 'b', label: 'Beta', tags: [], content: 'Linked' }]
  ])
  const reader = createNoteReader(element, {
    getNode: id => nodes.get(id) || null,
    getNeighbors: id => id === 'a' ? [nodes.get('b')] : []
  })

  await reader.openNote('a')
  await reader.next()
  assert.equal(findByClassName(element, 'note-reader-title').textContent, 'Beta')
  assert.equal(findByClassName(element, 'note-reader-counter').textContent, '1 / 1 LINKED')

  await reader.prev()
  assert.equal(findByClassName(element, 'note-reader-title').textContent, 'Beta')
  assert.equal(findByClassName(element, 'note-reader-counter').textContent, '1 / 1 LINKED')
})

test('zero linked neighbors leaves the current note in place', async () => {
  const element = createElement('div')
  const reader = createNoteReader(element, {
    getNode: () => ({ id: 'a', label: 'Alpha', tags: [], content: 'Root' }),
    getNeighbors: () => []
  })

  await reader.openNote('a')
  await reader.next()
  assert.equal(findByClassName(element, 'note-reader-title').textContent, 'Alpha')
  assert.equal(findByClassName(element, 'note-reader-counter').textContent, 'SOURCE / 0 LINKED')

  await reader.prev()
  assert.equal(findByClassName(element, 'note-reader-title').textContent, 'Alpha')
})

test('openNote on an unknown id fails safe', async () => {
  const element = createElement('div')
  const reader = createNoteReader(element, {
    getNode: () => null,
    getNeighbors: () => []
  })

  const opened = await reader.openNote('missing')

  assert.equal(opened, false)
  assert.equal(reader.isOpen(), false)
  assert.equal(element.hidden, true)
})

test('selection panel Open button calls openNote with the selected node id', () => {
  const element = createElement('div')
  const openedNodeIds = []
  const panel = createSelectionPanel(element, {
    onOpenNote(nodeId) {
      openedNodeIds.push(nodeId)
    }
  })

  panel.show({
    id: 'notes/alpha.md',
    label: 'Alpha',
    tags: []
  })
  findByClassName(element, 'selection-panel-open').click()

  assert.deepEqual(openedNodeIds, ['notes/alpha.md'])
})

function findByClassName(element, className) {
  if ((element.className || '').split(' ').includes(className)) return element

  for (const child of element.children || []) {
    const match = findByClassName(child, className)
    if (match) return match
  }

  return null
}

function createElement(tagName) {
  const ownerDocument = {
    activeElement: null,
    body: createBody(),
    createElement(childTagName) {
      return createElementWithDocument(childTagName, ownerDocument)
    }
  }

  return createElementWithDocument(tagName, ownerDocument)
}

function createBody() {
  const classes = new Set()
  return {
    classList: {
      add(className) {
        classes.add(className)
      },
      remove(className) {
        classes.delete(className)
      },
      contains(className) {
        return classes.has(className)
      }
    }
  }
}

function createElementWithDocument(tagName, ownerDocument) {
  const listeners = new Map()
  const attributes = new Map()
  const element = {
    tagName,
    ownerDocument,
    children: [],
    hidden: false,
    className: '',
    id: '',
    textContent: '',
    innerHTML: '',
    type: '',
    disabled: false,
    focusCount: 0,
    get firstChild() {
      return this.children[0] || null
    },
    appendChild(child) {
      this.children.push(child)
      this.textContent += child.textContent || ''
      return child
    },
    removeChild(child) {
      const index = this.children.indexOf(child)
      if (index !== -1) this.children.splice(index, 1)
      this.textContent = this.children.map(currentChild => currentChild.textContent || '').join('')
      return child
    },
    addEventListener(type, listener) {
      listeners.set(type, listener)
    },
    click() {
      listeners.get('click')?.()
    },
    focus() {
      this.focusCount += 1
      ownerDocument.activeElement = this
    },
    setAttribute(name, value) {
      attributes.set(name, String(value))
      if (name === 'id') this.id = String(value)
    },
    getAttribute(name) {
      return attributes.get(name)
    }
  }

  return element
}

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSelectionPanel } from '../src/selection-panel.js'

test('createSelectionPanel returns show and hide functions', () => {
  const panel = createSelectionPanel(createElement('div'))

  assert.equal(typeof panel.show, 'function')
  assert.equal(typeof panel.hide, 'function')
})

test('show unhides panel and appends node label and tags', () => {
  const panelElement = createElement('div')
  const panel = createSelectionPanel(panelElement)

  panel.show({
    id: 'notes/graph.md',
    label: 'Graph Notes',
    tags: ['threejs', 'gesture']
  })

  assert.equal(panelElement.hidden, false)
  assert.equal(panelElement.children.length, 2)
  assert.equal(panelElement.children[0].tagName, 'h2')
  assert.equal(panelElement.children[0].textContent, 'Graph Notes')
  assert.equal(panelElement.children[1].className, 'selection-panel-tags')
  assert.deepEqual(
    panelElement.children[1].children.map(child => child.textContent),
    ['#threejs', '#gesture']
  )
})

test('show falls back to node id when label is missing', () => {
  const panelElement = createElement('div')
  const panel = createSelectionPanel(panelElement)

  panel.show({
    id: 'missing:note',
    tags: ['missing']
  })

  assert.equal(panelElement.children[0].textContent, 'missing:note')
})

test('show omits the tag row when node has no tags', () => {
  const panelElement = createElement('div')
  const panel = createSelectionPanel(panelElement)

  panel.show({
    id: 'untagged-note',
    label: 'Untagged Note',
    tags: []
  })

  assert.equal(panelElement.children.length, 1)
  assert.equal(panelElement.children[0].textContent, 'Untagged Note')
})

test('show clears existing panel contents before rendering a node', () => {
  const panelElement = createElement('div')
  const panel = createSelectionPanel(panelElement)

  panel.show({
    id: 'first',
    label: 'First',
    tags: ['old']
  })
  panel.show({
    id: 'second',
    label: 'Second',
    tags: ['new']
  })

  assert.equal(panelElement.children.length, 2)
  assert.equal(panelElement.children[0].textContent, 'Second')
  assert.deepEqual(
    panelElement.children[1].children.map(child => child.textContent),
    ['#new']
  )
})

test('hide sets hidden to true', () => {
  const panelElement = createElement('div')
  const panel = createSelectionPanel(panelElement)

  panel.show({
    id: 'note',
    label: 'Note',
    tags: []
  })
  panel.hide()

  assert.equal(panelElement.hidden, true)
})

test('hide clears rendered selection details', () => {
  const panelElement = createElement('div')
  const panel = createSelectionPanel(panelElement)

  panel.show({
    id: 'stale-note',
    label: 'Stale Note',
    tags: ['old']
  })
  panel.hide()

  assert.equal(panelElement.hidden, true)
  assert.equal(panelElement.children.length, 0)
})

function createElement(tagName) {
  const ownerDocument = {
    createElement(childTagName) {
      return createElement(childTagName)
    }
  }

  const element = {
    tagName,
    ownerDocument,
    children: [],
    hidden: false,
    className: '',
    textContent: '',
    get firstChild() {
      return this.children[0] || null
    },
    appendChild(child) {
      this.children.push(child)
      return child
    },
    removeChild(child) {
      const index = this.children.indexOf(child)
      if (index !== -1) this.children.splice(index, 1)
      return child
    }
  }

  return element
}

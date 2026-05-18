import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createGestureHud } from '../src/gesture-hud.js'

const EXPECTED_LABELS = {
  idle: 'Ready',
  select: 'Selecting',
  drag: 'Dragging',
  orbit: 'Orbiting',
  zoom: 'Zooming'
}

test('update writes the idle label', () => {
  const element = createElement('div')
  const hud = createGestureHud(element)

  hud.update('idle')

  assert.match(element.textContent, /Ready/)
})

test('update writes the matching label for each gesture state', () => {
  for (const [state, label] of Object.entries(EXPECTED_LABELS)) {
    const element = createElement('div')
    const hud = createGestureHud(element)

    hud.update(state)

    assert.match(element.textContent, new RegExp(label))
  }
})

test('update with the same state does not re-render', () => {
  const element = createElement('div')
  const hud = createGestureHud(element)

  hud.update('drag')
  element.textContent = 'Manually preserved'
  hud.update('drag')

  assert.equal(element.textContent, 'Manually preserved')
})

test('update with the same state unhides the HUD after hide', () => {
  const element = createElement('div')
  const hud = createGestureHud(element)

  hud.update('drag')
  hud.hide()
  hud.update('drag')

  assert.equal(element.hidden, false)
})

test('active HUD glyph radius fits inside the viewbox', () => {
  const element = createElement('div')
  const hud = createGestureHud(element)

  hud.update('zoom')

  const radii = [...element.children[0].innerHTML.matchAll(/ r="([\d.]+)"/g)]
    .map(match => Number(match[1]))
  assert.ok(Math.max(...radii) <= 7.25)
})

test('show and hide toggle visibility', () => {
  const element = createElement('div')
  const hud = createGestureHud(element)

  hud.hide()
  assert.equal(element.hidden, true)

  hud.show()
  assert.equal(element.hidden, false)
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
      this.textContent += child.textContent || ''
      return child
    },
    removeChild(child) {
      const index = this.children.indexOf(child)
      if (index !== -1) this.children.splice(index, 1)
      this.textContent = this.children.map(currentChild => currentChild.textContent || '').join('')
      return child
    }
  }

  return element
}

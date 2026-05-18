import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createGestureLegend } from '../src/gesture-legend.js'

test('show makes the legend visible', () => {
  const element = createElement('div')
  const legend = createGestureLegend(element, { onDismiss() {} })

  legend.show()

  assert.equal(element.hidden, false)
})

test('hide makes the legend not visible', () => {
  const element = createElement('div')
  const legend = createGestureLegend(element, { onDismiss() {} })

  legend.show()
  legend.hide()

  assert.equal(element.hidden, true)
})

test('clicking the dismiss button fires onDismiss', () => {
  const element = createElement('div')
  let dismissCount = 0
  const legend = createGestureLegend(element, {
    onDismiss() {
      dismissCount += 1
    }
  })

  legend.show()
  findByTagName(element, 'button').click()

  assert.equal(dismissCount, 1)
})

test('clicking the dismiss button hides the legend without onDismiss', () => {
  const element = createElement('div')
  const legend = createGestureLegend(element)

  legend.show()
  findByTagName(element, 'button').click()

  assert.equal(element.hidden, true)
})

test('show moves focus to the dismiss button', () => {
  const element = createElement('div')
  const legend = createGestureLegend(element, { onDismiss() {} })

  legend.show()

  assert.equal(findByTagName(element, 'button').focusCount, 1)
})

test('legend contains the expected gesture labels', () => {
  const element = createElement('div')
  const legend = createGestureLegend(element, { onDismiss() {} })

  legend.show()

  assert.match(element.textContent, /Pinch/)
  assert.match(element.textContent, /Pinch and hold/)
  assert.match(element.textContent, /Open palm/)
  assert.match(element.textContent, /Both palms open/)
})

function findByTagName(element, tagName) {
  if (element.tagName === tagName) return element

  for (const child of element.children) {
    const match = findByTagName(child, tagName)
    if (match) return match
  }

  return null
}

function createElement(tagName) {
  const ownerDocument = {
    createElement(childTagName) {
      return createElement(childTagName)
    }
  }

  const listeners = new Map()
  const element = {
    tagName,
    ownerDocument,
    children: [],
    hidden: false,
    className: '',
    textContent: '',
    type: '',
    innerHTML: '',
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
    }
  }

  return element
}

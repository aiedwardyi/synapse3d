const GESTURES = [
  {
    label: 'Pinch',
    description: 'Pinch to select a node',
    glyph: renderPinchGlyph()
  },
  {
    label: 'Pinch and hold',
    description: 'Pinch and hold to drag a node',
    glyph: renderPinchHoldGlyph()
  },
  {
    label: 'Open palm',
    description: 'Open your hand to orbit the camera',
    glyph: renderOpenPalmGlyph()
  },
  {
    label: 'Both palms open',
    description: 'Both hands open: spread to zoom',
    glyph: renderBothPalmsGlyph()
  }
]

export function createGestureLegend(element, { onDismiss } = {}) {
  return {
    show() {
      renderLegend(element, onDismiss)
      element.hidden = false
    },
    hide() {
      element.hidden = true
    }
  }
}

function renderLegend(element, onDismiss) {
  clearChildren(element)
  element.className = 'gesture-legend-backdrop'

  const dialog = createChildElement(element, 'section')
  dialog.className = 'gesture-legend-dialog'
  dialog.setAttribute?.('aria-modal', 'true')
  dialog.setAttribute?.('role', 'dialog')
  dialog.setAttribute?.('aria-labelledby', 'gesture-legend-title')

  const title = createChildElement(element, 'h2')
  title.id = 'gesture-legend-title'
  title.textContent = 'Gesture controls'
  dialog.appendChild(title)

  const rows = createChildElement(element, 'div')
  rows.className = 'gesture-legend-rows'
  for (const gesture of GESTURES) {
    rows.appendChild(renderGestureRow(element, gesture))
  }
  dialog.appendChild(rows)

  const dismissButton = createChildElement(element, 'button')
  dismissButton.type = 'button'
  dismissButton.className = 'gesture-legend-dismiss'
  dismissButton.textContent = 'Got it'
  dismissButton.addEventListener?.('click', () => {
    onDismiss?.()
  })
  dialog.appendChild(dismissButton)

  element.appendChild(dialog)
}

function renderGestureRow(element, gesture) {
  const row = createChildElement(element, 'div')
  row.className = 'gesture-legend-row'

  const glyph = createChildElement(element, 'span')
  glyph.className = 'gesture-legend-glyph'
  glyph.setAttribute?.('aria-hidden', 'true')
  glyph.innerHTML = gesture.glyph
  row.appendChild(glyph)

  const copy = createChildElement(element, 'div')
  copy.className = 'gesture-legend-copy'

  const label = createChildElement(element, 'span')
  label.className = 'gesture-legend-label'
  label.textContent = gesture.label
  copy.appendChild(label)

  const description = createChildElement(element, 'span')
  description.className = 'gesture-legend-description'
  description.textContent = gesture.description
  copy.appendChild(description)

  row.appendChild(copy)
  return row
}

function renderPinchGlyph() {
  return '<svg viewBox="0 0 32 32" focusable="false" aria-hidden="true"><path d="M11 20c2-4 4-7 7-11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M21 10c2 2 3 4 3 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="17" cy="10" r="2" fill="currentColor"/><circle cx="22" cy="17" r="2" fill="currentColor"/><path d="M10 21c3 5 10 6 14 1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
}

function renderPinchHoldGlyph() {
  return '<svg viewBox="0 0 32 32" focusable="false" aria-hidden="true"><path d="M10 20c2-4 4-7 7-11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M21 10c2 2 3 4 3 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="17" cy="10" r="2" fill="currentColor"/><circle cx="22" cy="17" r="2" fill="currentColor"/><path d="M8 24h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
}

function renderOpenPalmGlyph() {
  return '<svg viewBox="0 0 32 32" focusable="false" aria-hidden="true"><path d="M9 17V8M14 16V5M19 16V7M24 17v-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9 18c0 7 4 10 9 10s8-4 8-10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 20l4 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
}

function renderBothPalmsGlyph() {
  return '<svg viewBox="0 0 32 32" focusable="false" aria-hidden="true"><path d="M8 16V8M12 16V6M16 17V8M6 18c1 5 4 7 8 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M24 16V8M20 16V6M16 17V8M26 18c-1 5-4 7-8 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
}

function clearChildren(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild)
  }
}

function createChildElement(parentElement, tagName) {
  const documentRef = parentElement.ownerDocument || globalThis.document
  if (documentRef?.createElement) return documentRef.createElement(tagName)

  return {
    tagName,
    children: [],
    className: '',
    id: '',
    textContent: '',
    innerHTML: '',
    type: '',
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
    },
    addEventListener() {},
    setAttribute() {}
  }
}

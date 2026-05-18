const GESTURE_LABELS = {
  idle: 'Ready',
  select: 'Selecting',
  drag: 'Dragging',
  orbit: 'Orbiting',
  zoom: 'Zooming'
}

export function createGestureHud(element) {
  let lastRenderedState = null

  return {
    update(state) {
      const normalizedState = GESTURE_LABELS[state] ? state : 'idle'
      if (normalizedState === lastRenderedState) {
        element.hidden = false
        return
      }

      clearChildren(element)

      const glyph = createChildElement(element, 'span')
      glyph.className = 'gesture-hud-glyph'
      glyph.setAttribute?.('aria-hidden', 'true')
      glyph.innerHTML = renderHudGlyph(normalizedState)
      element.appendChild(glyph)

      const label = createChildElement(element, 'span')
      label.className = 'gesture-hud-label'
      label.textContent = GESTURE_LABELS[normalizedState]
      element.appendChild(label)

      element.hidden = false
      lastRenderedState = normalizedState
    },
    show() {
      element.hidden = false
    },
    hide() {
      element.hidden = true
    }
  }
}

function renderHudGlyph(state) {
  const activeDot = state === 'idle' ? '4' : '6.5'

  return `<svg viewBox="0 0 16 16" focusable="false" aria-hidden="true"><circle cx="8" cy="8" r="${activeDot}" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>`
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
    textContent: '',
    innerHTML: '',
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
    setAttribute() {}
  }
}

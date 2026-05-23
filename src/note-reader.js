import { renderMarkdown } from './markdown.js'

const BODY_OPEN_CLASS = 'note-reader-open'
const READER_ROOT_CLASS = 'note-reader-shell'
const READER_VISIBLE_CLASS = 'note-reader-visible'
const READER_CLOSING_CLASS = 'note-reader-closing'
const CLOSE_TRANSITION_MS = 220
const EMPTY_CONTENT = 'No note content available.'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function createNoteReader(element, {
  getNode,
  getNeighbors,
  renderContent = renderMarkdown
} = {}) {
  let open = false
  let rootNodeId = null
  let currentNodeId = null
  let linkedNodes = []
  let linkedIndex = -1
  let cancelCloseAnimation = null

  async function openNote(nodeId) {
    stopCloseAnimation()
    const node = getNode?.(nodeId)
    if (!node) {
      close()
      return false
    }

    rootNodeId = node.id
    currentNodeId = node.id
    linkedNodes = collectLinkedNodes(node.id)
    linkedIndex = -1
    open = true
    renderNode(node)
    return true
  }

  async function next() {
    if (!open || linkedNodes.length === 0) return false

    const index = linkedIndex === -1 ? 0 : linkedIndex + 1
    return openLinkedIndex(index)
  }

  async function prev() {
    if (!open || linkedNodes.length === 0) return false

    const index = linkedIndex === -1 ? linkedNodes.length - 1 : linkedIndex - 1
    return openLinkedIndex(index)
  }

  function close() {
    stopCloseAnimation()
    const shouldAnimate = open && canAnimateReader(element) && element.firstChild

    removeBodyOpenClass(element)
    open = false
    rootNodeId = null
    currentNodeId = null
    linkedNodes = []
    linkedIndex = -1

    if (shouldAnimate) {
      setReaderClass(READER_CLOSING_CLASS)
      waitForCloseTransition(element.firstChild)
      return
    }

    finishClose()
  }

  function openLinkedIndex(index) {
    const nextIndex = wrapIndex(index, linkedNodes.length)
    const node = linkedNodes[nextIndex]
    if (!node) return false

    linkedIndex = nextIndex
    currentNodeId = node.id
    renderNode(node)
    return true
  }

  function collectLinkedNodes(nodeId) {
    const seen = new Set()
    const neighbors = getNeighbors?.(nodeId) || []
    const nodes = []

    for (const neighbor of neighbors) {
      const node = typeof neighbor === 'string' ? getNode?.(neighbor) : neighbor
      if (!node || !node.id || node.id === nodeId || seen.has(node.id)) continue

      seen.add(node.id)
      nodes.push(node)
    }

    return nodes
  }

  function renderNode(node) {
    clearChildren(element)
    setReaderClass()
    element.setAttribute?.('role', 'presentation')

    const panel = createChildElement(element, 'section')
    panel.className = 'note-reader-panel'
    panel.setAttribute?.('role', 'dialog')
    panel.setAttribute?.('aria-modal', 'true')
    panel.setAttribute?.('aria-labelledby', 'note-reader-title')

    panel.appendChild(renderHeader(node))
    panel.appendChild(renderContentBlock(node))
    panel.appendChild(renderFooter())

    element.appendChild(panel)
    element.hidden = false
    addBodyOpenClass(element)
    showReaderPanel()
  }

  function renderHeader(node) {
    const header = createChildElement(element, 'header')
    header.className = 'note-reader-header'

    const kicker = createChildElement(element, 'div')
    kicker.className = 'note-reader-kicker'
    kicker.textContent = 'Readout'
    header.appendChild(kicker)

    const title = createChildElement(element, 'h2')
    title.className = 'note-reader-title'
    title.id = 'note-reader-title'
    title.textContent = node.label || node.id
    header.appendChild(title)

    if (Array.isArray(node.tags) && node.tags.length > 0) {
      const tagRow = createChildElement(element, 'div')
      tagRow.className = 'selection-panel-tags'

      for (const tag of node.tags) {
        const tagChip = createChildElement(element, 'span')
        tagChip.className = 'selection-panel-tag'
        tagChip.textContent = `#${tag}`
        tagRow.appendChild(tagChip)
      }

      header.appendChild(tagRow)
    }

    return header
  }

  function renderContentBlock(node) {
    const content = createChildElement(element, 'div')
    content.className = 'note-reader-content'
    content.innerHTML = renderContent(noteContent(node))
    return content
  }

  function renderFooter() {
    const footer = createChildElement(element, 'footer')
    footer.className = 'note-reader-bar'

    const prevButton = renderButton('PREV', 'note-reader-action', () => {
      prev()
    })
    prevButton.disabled = linkedNodes.length === 0
    footer.appendChild(prevButton)

    const counter = createChildElement(element, 'span')
    counter.className = 'note-reader-counter'
    counter.textContent = formatCounter()
    footer.appendChild(counter)

    const nextButton = renderButton('NEXT', 'note-reader-action', () => {
      next()
    })
    nextButton.disabled = linkedNodes.length === 0
    footer.appendChild(nextButton)

    const closeButton = renderButton('CLOSE', 'note-reader-close', close)
    footer.appendChild(closeButton)

    return footer
  }

  function renderButton(label, className, onClick) {
    const button = createChildElement(element, 'button')
    button.type = 'button'
    button.className = className
    button.textContent = label
    button.addEventListener?.('click', onClick)
    return button
  }

  function formatCounter() {
    // The root note is outside the linked sequence; linked notes use 1-based positions.
    if (linkedIndex === -1) return `SOURCE / ${linkedNodes.length} LINKED`

    const position = linkedIndex + 1
    return `${position} / ${linkedNodes.length} LINKED`
  }

  function noteContent(node) {
    return typeof node.content === 'string' && node.content.trim() ? node.content : EMPTY_CONTENT
  }

  return {
    openNote,
    close,
    next,
    prev,
    isOpen() {
      return open
    },
    currentNodeId() {
      return currentNodeId
    },
    rootNodeId() {
      return rootNodeId
    }
  }

  function showReaderPanel() {
    const view = getElementView(element)
    if (!canAnimateReader(element) || !view?.requestAnimationFrame) {
      setReaderClass(READER_VISIBLE_CLASS)
      return
    }

    view.requestAnimationFrame(() => {
      if (open && !element.hidden) setReaderClass(READER_VISIBLE_CLASS)
    })
  }

  function waitForCloseTransition(panel) {
    let complete = false
    const view = getElementView(element)
    const timeoutId = view?.setTimeout?.(finish, CLOSE_TRANSITION_MS + 80)

    function finish(event) {
      if (event && event.target !== panel) return
      if (complete) return

      complete = true
      panel.removeEventListener?.('transitionend', finish)
      if (timeoutId !== undefined) view?.clearTimeout?.(timeoutId)
      cancelCloseAnimation = null
      finishClose()
    }

    cancelCloseAnimation = () => {
      if (complete) return

      complete = true
      panel.removeEventListener?.('transitionend', finish)
      if (timeoutId !== undefined) view?.clearTimeout?.(timeoutId)
      cancelCloseAnimation = null
    }

    panel.addEventListener?.('transitionend', finish)
  }

  function stopCloseAnimation() {
    cancelCloseAnimation?.()
  }

  function finishClose() {
    clearChildren(element)
    element.hidden = true
    setReaderClass()
  }

  function setReaderClass(stateClass = '') {
    element.className = stateClass ? `${READER_ROOT_CLASS} ${stateClass}` : READER_ROOT_CLASS
  }
}

function wrapIndex(index, length) {
  return ((index % length) + length) % length
}

function addBodyOpenClass(element) {
  element.ownerDocument?.body?.classList?.add(BODY_OPEN_CLASS)
}

function removeBodyOpenClass(element) {
  element.ownerDocument?.body?.classList?.remove(BODY_OPEN_CLASS)
}

function canAnimateReader(element) {
  const view = getElementView(element)
  if (!view?.matchMedia) return false

  return !view.matchMedia(REDUCED_MOTION_QUERY).matches
}

function getElementView(element) {
  return element.ownerDocument?.defaultView || globalThis
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
    disabled: false,
    hidden: false,
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

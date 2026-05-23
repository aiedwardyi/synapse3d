export function createSelectionPanel(panelElement, { onOpenNote } = {}) {
  return {
    show(node) {
      clearChildren(panelElement)

      const title = createChildElement(panelElement, 'h2')
      title.textContent = node.label || node.id
      panelElement.appendChild(title)

      if (Array.isArray(node.tags) && node.tags.length > 0) {
        const tagRow = createChildElement(panelElement, 'div')
        tagRow.className = 'selection-panel-tags'

        for (const tag of node.tags) {
          const tagChip = createChildElement(panelElement, 'span')
          tagChip.className = 'selection-panel-tag'
          tagChip.textContent = `#${tag}`
          tagRow.appendChild(tagChip)
        }

        panelElement.appendChild(tagRow)
      }

      if (typeof onOpenNote === 'function') {
        const openButton = createChildElement(panelElement, 'button')
        openButton.type = 'button'
        openButton.className = 'selection-panel-open'
        openButton.textContent = 'Open'
        openButton.addEventListener?.('click', () => {
          onOpenNote(node.id)
        })
        panelElement.appendChild(openButton)
      }

      panelElement.hidden = false
    },
    hide() {
      clearChildren(panelElement)
      panelElement.hidden = true
    }
  }
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
    addEventListener() {}
  }
}

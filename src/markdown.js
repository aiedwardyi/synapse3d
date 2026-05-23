const FENCE_MARKER = '```'

export function renderMarkdown(markdown) {
  const source = typeof markdown === 'string' ? markdown : ''
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (line.trim() === '') {
      index++
      continue
    }

    if (isFence(line)) {
      const codeLines = []
      index++
      while (index < lines.length && !isFence(lines[index])) {
        codeLines.push(lines[index])
        index++
      }
      if (index < lines.length) index++
      blocks.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`)
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      blocks.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`)
      index++
      continue
    }

    const unorderedList = parseList(lines, index, 'ul')
    if (unorderedList) {
      blocks.push(unorderedList.html)
      index = unorderedList.nextIndex
      continue
    }

    const orderedList = parseList(lines, index, 'ol')
    if (orderedList) {
      blocks.push(orderedList.html)
      index = orderedList.nextIndex
      continue
    }

    const paragraphLines = []
    while (
      index < lines.length &&
      lines[index].trim() !== '' &&
      !isFence(lines[index]) &&
      !isHeading(lines[index]) &&
      !isSupportedListItem(lines[index])
    ) {
      paragraphLines.push(lines[index])
      index++
    }

    if (paragraphLines.length > 0) {
      const content = paragraphLines
        .map(paragraphLine => renderInline(paragraphLine.trimEnd()))
        .join('<br>')
      blocks.push(`<p>${content}</p>`)
    }
  }

  return blocks.join('')
}

function parseList(lines, startIndex, tagName) {
  const itemPattern = tagName === 'ul'
    ? /^\s*[-*+]\s+(.+)$/
    : /^\s*\d+[.)]\s+(.+)$/
  const items = []
  let index = startIndex

  while (index < lines.length) {
    const match = lines[index].match(itemPattern)
    if (!match) break

    items.push(`<li>${renderInline(match[1].trim())}</li>`)
    index++
  }

  if (items.length === 0) return null

  return {
    html: `<${tagName}>${items.join('')}</${tagName}>`,
    nextIndex: index
  }
}

function renderInline(value) {
  const tokens = []
  let text = escapeHtml(value)

  function reserve(html) {
    const token = `\u0000${tokens.length}\u0000`
    tokens.push(html)
    return token
  }

  text = text.replace(/`([^`\n]+)`/g, (match, code) => reserve(`<code>${code}</code>`))
  text = text.replace(/\[\[([^\]\n]+)\]\]/g, (match, rawTarget) => {
    const label = wikilinkLabel(rawTarget)
    return reserve(`<span class="markdown-wikilink">${label}</span>`)
  })
  text = text.replace(/(^|[^!])\[([^\]\n]+)\]\(([^)\n]+)\)/g, (match, prefix, label, href) => {
    const link = renderLink(label, href)
    return `${prefix}${reserve(link)}`
  })
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
  text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
  text = text.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>')

  for (let i = 0; i < tokens.length; i++) {
    text = text.replaceAll(`\u0000${i}\u0000`, tokens[i])
  }

  return text
}

function renderLink(label, href) {
  const safeHref = sanitizeHref(href)
  if (!safeHref) return `[${label}](${href})`

  return `<a href="${safeHref}" rel="noreferrer" target="_blank">${label}</a>`
}

function sanitizeHref(href) {
  const trimmed = href.trim()
  const compact = trimmed.replace(/[\u0000-\u001f\u007f\s]+/g, '').toLowerCase()
  const hasScheme = /^[a-z][a-z0-9+.-]*:/.test(compact)

  if (
    hasScheme &&
    !compact.startsWith('http:') &&
    !compact.startsWith('https:') &&
    !compact.startsWith('mailto:')
  ) {
    return ''
  }

  return trimmed.replaceAll('"', '&quot;')
}

function wikilinkLabel(rawTarget) {
  const parts = rawTarget.split('|')
  return parts[parts.length - 1].trim()
}

function isFence(line) {
  return line.trim().startsWith(FENCE_MARKER)
}

function isHeading(line) {
  return /^(#{1,6})\s+(.+)$/.test(line)
}

function isSupportedListItem(line) {
  return /^\s*[-*+]\s+(.+)$/.test(line) || /^\s*\d+[.)]\s+(.+)$/.test(line)
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

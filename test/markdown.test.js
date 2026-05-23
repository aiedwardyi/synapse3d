import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderMarkdown } from '../src/markdown.js'

test('renders headings through level six', () => {
  const html = renderMarkdown('# One\n### Three\n###### Six')

  assert.equal(html, '<h1>One</h1><h3>Three</h3><h6>Six</h6>')
})

test('renders bold italic inline code and wikilinks', () => {
  const html = renderMarkdown('Text with **bold**, *italic*, `code`, and [[Linked Note]].')

  assert.equal(
    html,
    '<p>Text with <strong>bold</strong>, <em>italic</em>, <code>code</code>, and <span class="markdown-wikilink">Linked Note</span>.</p>'
  )
})

test('renders fenced code blocks without inline formatting', () => {
  const html = renderMarkdown('```js\nconst value = **raw**\n```')

  assert.equal(html, '<pre><code>const value = **raw**</code></pre>')
})

test('renders unordered and ordered lists', () => {
  const html = renderMarkdown('- Alpha\n- Beta\n\n1. First\n2. Second')

  assert.equal(html, '<ul><li>Alpha</li><li>Beta</li></ul><ol><li>First</li><li>Second</li></ol>')
})

test('renders links with escaped labels and safe href attributes', () => {
  const html = renderMarkdown('[Docs <site>](https://example.com/?q=1&x=2)')

  assert.equal(
    html,
    '<p><a href="https://example.com/?q=1&amp;x=2" rel="noreferrer" target="_blank">Docs &lt;site&gt;</a></p>'
  )
})

test('renders unsafe link schemes as inert escaped text', () => {
  const html = renderMarkdown('[Bad](javascript:alert(1))')

  assert.equal(html, '<p>[Bad](javascript:alert(1))</p>')
})

test('escapes source HTML before applying markdown formatting', () => {
  const html = renderMarkdown('<script>alert("x")</script> **safe**')

  assert.equal(
    html,
    '<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; <strong>safe</strong></p>'
  )
})

test('falls back to escaped paragraph text for unrecognized syntax', () => {
  const html = renderMarkdown('> quoted <raw>')

  assert.equal(html, '<p>&gt; quoted &lt;raw&gt;</p>')
})

test('preserves paragraph line breaks', () => {
  const html = renderMarkdown('Alpha\nBeta')

  assert.equal(html, '<p>Alpha<br>Beta</p>')
})

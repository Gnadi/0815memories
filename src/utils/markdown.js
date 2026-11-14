/**
 * Markdown for recipe instructions, in and out of the rich document format.
 *
 * Markdown is never turned into HTML. It is parsed into the same ProseMirror
 * JSON the rich editor writes, and RichContent renders that — so there is one
 * reader for both formats, and no HTML string a sanitizer would have to get
 * right. Raw HTML in the source stays visible as text, images keep only their
 * alt text (an external image would tell its host who reads the recipe), and
 * link hrefs go through RichContent's protocol allowlist like any other.
 *
 * The other direction, richToMarkdown, is for switching a recipe's editor from
 * rich text to Markdown without losing what was written.
 */
import { Lexer } from 'marked'
import { isRichDoc } from './richText'

// `breaks`: a single newline is a line break, as people expect who have never
// heard of Markdown's soft breaks — a recipe's steps are often one per line.
const LEXER_OPTIONS = { gfm: true, breaks: true }

const MARK_FOR_TOKEN = {
  strong: { type: 'bold' },
  em: { type: 'italic' },
  del: { type: 'strike' },
}

function textNode(text, marks) {
  if (!text) return null
  return marks.length ? { type: 'text', text, marks } : { type: 'text', text }
}

// Escapes arrive as tokens of their own; text next to text with the same
// marks is one node, as the editor would have made it.
function mergeText(nodes) {
  const out = []
  for (const node of nodes) {
    const last = out[out.length - 1]
    if (node.type === 'text' && last?.type === 'text'
        && JSON.stringify(last.marks ?? []) === JSON.stringify(node.marks ?? [])) {
      out[out.length - 1] = { ...last, text: last.text + node.text }
    } else {
      out.push(node)
    }
  }
  return out
}

function inlineNodes(tokens, marks = []) {
  const out = []
  const push = (node) => node && out.push(node)

  for (const token of tokens || []) {
    switch (token.type) {
      case 'strong':
      case 'em':
      case 'del':
        out.push(...inlineNodes(token.tokens, [...marks, MARK_FOR_TOKEN[token.type]]))
        break
      case 'link':
        out.push(...inlineNodes(token.tokens, [...marks, { type: 'link', attrs: { href: token.href } }]))
        break
      case 'codespan':
        push(textNode(token.text, [...marks, { type: 'code' }]))
        break
      case 'br':
        out.push({ type: 'hardBreak' })
        break
      case 'image':
        push(textNode(token.text, marks))
        break
      case 'text':
        // A list item's text token nests its inline tokens one level deeper.
        if (token.tokens) out.push(...inlineNodes(token.tokens, marks))
        else push(textNode(token.text, marks))
        break
      default:
        // escape, html and anything newer: the characters as written.
        push(textNode(token.text ?? token.raw ?? '', marks))
    }
  }
  return mergeText(out)
}

function paragraph(content) {
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
}

function listItem(item) {
  const content = []
  // A task's checkbox has no node of its own, so it becomes a character.
  let prefix = item.task ? (item.checked ? '☑ ' : '☐ ') : ''
  for (const token of item.tokens || []) {
    if (token.type === 'checkbox') continue
    if (token.type === 'text' || token.type === 'paragraph') {
      const inline = inlineNodes(token.tokens || [token])
      if (prefix) inline.unshift({ type: 'text', text: prefix })
      prefix = ''
      content.push(paragraph(inline))
    } else {
      content.push(...blockNodes([token]))
    }
  }
  // The document format wants every list item to open with a paragraph.
  if (content[0]?.type !== 'paragraph') content.unshift(paragraph([]))
  return { type: 'listItem', content }
}

function blockNodes(tokens) {
  const out = []
  for (const token of tokens || []) {
    switch (token.type) {
      case 'space':
      case 'def':
        break
      case 'heading':
        // The recipe title is the page's h1, and the editor offers h2 and h3.
        out.push({
          type: 'heading',
          attrs: { level: token.depth <= 2 ? 2 : 3 },
          content: inlineNodes(token.tokens),
        })
        break
      case 'paragraph':
        out.push(paragraph(inlineNodes(token.tokens)))
        break
      case 'text':
        out.push(paragraph(inlineNodes(token.tokens || [token])))
        break
      case 'list': {
        const items = token.items.map(listItem)
        out.push(
          token.ordered
            ? { type: 'orderedList', attrs: { start: Number(token.start) || 1 }, content: items }
            : { type: 'bulletList', content: items },
        )
        break
      }
      case 'blockquote':
        out.push({ type: 'blockquote', content: blockNodes(token.tokens) })
        break
      case 'code':
        out.push({ type: 'codeBlock', content: token.text ? [{ type: 'text', text: token.text }] : [] })
        break
      case 'hr':
        out.push({ type: 'horizontalRule' })
        break
      case 'table': {
        // No table in the document format: one line per row keeps every cell
        // readable without a renderer of its own.
        const row = (cells) => {
          const inline = []
          cells.forEach((cell, i) => {
            if (i > 0) inline.push({ type: 'text', text: ' · ' })
            inline.push(...inlineNodes(cell.tokens))
          })
          return paragraph(inline)
        }
        out.push(row(token.header), ...token.rows.map(row))
        break
      }
      default:
        // html blocks and anything newer: the source as written.
        if (token.raw?.trim()) out.push(paragraph([{ type: 'text', text: token.raw.trim() }]))
    }
  }
  return out
}

/** A Markdown string as a rich document, ready for RichContent. */
export function markdownToRich(markdown) {
  if (typeof markdown !== 'string' || !markdown.trim()) return { type: 'doc', content: [{ type: 'paragraph' }] }
  const content = blockNodes(new Lexer(LEXER_OPTIONS).lex(markdown))
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
}

// ── Rich document → Markdown ────────────────────────────────────────

// Characters that would otherwise start emphasis, code or a link.
const escapeInline = (text) => text.replace(/([\\`*_~[\]<])/g, '\\$1')

// Characters at the start of a line that would otherwise start a block.
const escapeLineStart = (line) =>
  line.replace(/^(\s*)(#|>|[-+*](?=\s))/, '$1\\$2').replace(/^(\s*\d+)([.)])(?=\s)/, '$1\\$2')

const MARK_DELIMITERS = { bold: '**', italic: '_', strike: '~~' }

function serializeText(node) {
  let text = node.text || ''
  const marks = node.marks || []
  if (marks.some((m) => m.type === 'code')) {
    text = `\`${text}\``
  } else {
    text = escapeInline(text)
  }

  // Whitespace inside a delimiter breaks it ("** bold**" is not bold), so it
  // goes outside.
  const [, lead, core, trail] = text.match(/^(\s*)([\s\S]*?)(\s*)$/)
  if (!core) return text
  let wrapped = core
  for (const mark of marks) {
    const delimiter = MARK_DELIMITERS[mark.type]
    if (delimiter) wrapped = `${delimiter}${wrapped}${delimiter}`
  }
  const link = marks.find((m) => m.type === 'link')
  if (link?.attrs?.href) wrapped = `[${wrapped}](${link.attrs.href.replace(/[()\s]/g, encodeURIComponent)})`
  return lead + wrapped + trail
}

function serializeInline(nodes) {
  return (nodes || [])
    .map((node) => (node.type === 'hardBreak' ? '\n' : node.type === 'text' ? serializeText(node) : ''))
    .join('')
}

function prefixLines(text, first, rest) {
  return text
    .split('\n')
    .map((line, i) => (i === 0 ? first : line ? rest : rest.trimEnd()) + line)
    .join('\n')
}

// A list item's blocks are joined by a single newline, which keeps the list
// tight; a blank line between them would space every item apart.
function serializeBlocks(nodes, separator = '\n\n') {
  return (nodes || []).map(serializeBlock).filter((block) => block !== null).join(separator)
}

function serializeBlock(node) {
  switch (node.type) {
    case 'paragraph':
      return serializeInline(node.content).split('\n').map(escapeLineStart).join('\n')
    case 'heading':
      return `${'#'.repeat(Math.min(Math.max(Number(node.attrs?.level) || 2, 1), 6))} ${serializeInline(node.content)}`
    case 'bulletList':
    case 'orderedList': {
      const start = Number(node.attrs?.start) || 1
      return (node.content || [])
        .map((item, i) => {
          const marker = node.type === 'orderedList' ? `${start + i}. ` : '- '
          return prefixLines(serializeBlocks(item.content, '\n'), marker, ' '.repeat(marker.length))
        })
        .join('\n')
    }
    case 'blockquote':
      return prefixLines(serializeBlocks(node.content), '> ', '> ')
    case 'codeBlock':
      return `\`\`\`\n${(node.content || []).map((n) => n.text || '').join('')}\n\`\`\``
    case 'horizontalRule':
      return '---'
    default:
      // Media and unknown nodes have no Markdown; recipe instructions hold none.
      return null
  }
}

/** A rich document as Markdown, for switching an editor to Markdown. */
export function richToMarkdown(doc) {
  if (!isRichDoc(doc)) return ''
  return serializeBlocks(doc.content).trim()
}

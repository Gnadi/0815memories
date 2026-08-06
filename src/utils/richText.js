/**
 * Helpers for the rich memory description (`memory.contentRich`).
 *
 * The description is stored as a ProseMirror/TipTap document. These helpers are
 * deliberately dependency-free — no TipTap import — because the read path
 * (MemoryBody, RichContent) and the NAS export use them too, and neither should
 * pull the editor into its bundle.
 *
 * Persistence shape: the document travels to Firestore as a JSON *string*, so it
 * rides the same encryptFields() path as every other text field. See
 * MEMORY_WRITE_FIELDS in src/hooks/useMemories.js.
 */

export const EMPTY_RICH_DOC = { type: 'doc', content: [{ type: 'paragraph' }] }

// Node types that carry an encrypted media asset rather than text.
export const MEDIA_NODE_TYPES = {
  encryptedImage: 'image',
  encryptedVideo: 'video',
  encryptedAudio: 'audio',
}

/**
 * True only for a decrypted *and* parsed document. A ciphertext string, a
 * plaintext JSON string and legacy `undefined` all return false, which is what
 * makes the three-way read fallback in MemoryBody safe: anything that is not a
 * real document falls back to the plain-text `content` mirror.
 */
export function isRichDoc(value) {
  return !!value && typeof value === 'object' && value.type === 'doc' && Array.isArray(value.content)
}

/**
 * Parse a decrypted `contentRich` string into a document. Returns the input
 * untouched when it is not parseable JSON — a still-encrypted field must stay a
 * string so callers fall back rather than render garbage.
 */
export function parseRichDoc(value) {
  if (typeof value !== 'string') return value
  try {
    const parsed = JSON.parse(value)
    return isRichDoc(parsed) ? parsed : value
  } catch {
    return value
  }
}

// ── Plain text ⇄ document ───────────────────────────────────────────

/**
 * Seed a document from legacy plain-text `content`. Blank lines separate
 * paragraphs; a single newline becomes a hard break — which is also how the old
 * renderer *should* have behaved (it dropped single newlines entirely).
 */
export function plainTextToRich(text) {
  if (!text || typeof text !== 'string') return { ...EMPTY_RICH_DOC }

  const paragraphs = text.split(/\n{2,}/)
  const content = paragraphs.map((block) => {
    const lines = block.split('\n')
    const inline = []
    lines.forEach((line, i) => {
      if (i > 0) inline.push({ type: 'hardBreak' })
      if (line) inline.push({ type: 'text', text: line })
    })
    return inline.length ? { type: 'paragraph', content: inline } : { type: 'paragraph' }
  })

  return { type: 'doc', content }
}

// Block types that each produce their own line in the flattened text. Wrappers
// (blockquote, lists, list items) are not here on purpose — they recurse, so the
// paragraphs inside them each become a line of their own.
const LINE_BLOCKS = new Set(['paragraph', 'heading', 'codeBlock'])

/**
 * Flatten a document to plain text for the `content` mirror.
 *
 * Every preview surface in the app (feed cards, timeline, Web Share) reads
 * `content`, so the output has to keep today's shape: one line per block,
 * blocks joined by a blank line. Media nodes contribute their caption/title
 * when they have one, and nothing otherwise.
 */
export function richToPlainText(doc) {
  if (!isRichDoc(doc)) return ''

  const lines = []

  const inlineText = (node) => {
    if (!node) return ''
    if (node.type === 'text') return node.text || ''
    if (node.type === 'hardBreak') return '\n'
    if (Array.isArray(node.content)) return node.content.map(inlineText).join('')
    return ''
  }

  const walk = (node) => {
    if (!node || typeof node !== 'object') return

    if (node.type in MEDIA_NODE_TYPES) {
      const label = node.attrs?.caption || node.attrs?.title || ''
      if (label) lines.push(label)
      return
    }

    if (LINE_BLOCKS.has(node.type)) {
      const text = inlineText(node).trim()
      if (text) lines.push(text)
      return
    }

    ;(node.content || []).forEach(walk)
  }

  ;(doc.content || []).forEach(walk)

  return lines.join('\n\n')
}

export function richDocIsEmpty(doc) {
  if (!isRichDoc(doc)) return true
  if (!doc.content.length) return true
  const hasMedia = collectRichMediaUrls(doc).length > 0
  return !hasMedia && richToPlainText(doc).trim() === ''
}

// ── Media ───────────────────────────────────────────────────────────

/**
 * Every inline media asset in the document, in document order. Used by the NAS
 * export so a backup contains the photos and clips that live inside the story,
 * not just the ones in the separate gallery arrays.
 */
export function collectRichMediaUrls(doc) {
  const found = []
  if (!isRichDoc(doc)) return found

  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    const kind = MEDIA_NODE_TYPES[node.type]
    if (kind && node.attrs?.src) found.push({ kind, url: node.attrs.src })
    ;(node.content || []).forEach(walk)
  }

  doc.content.forEach(walk)
  return found
}

/**
 * Drop media nodes whose upload never finished (`src` still empty).
 *
 * A safety net, not the primary guard: the blob: preview URL of an in-flight
 * upload lives in previewStore, never in the document, so it cannot be
 * persisted even if this were skipped. See
 * src/components/admin/richTextEditor/previewStore.js.
 */
export function stripPendingMedia(doc) {
  if (!isRichDoc(doc)) return doc

  const clean = (nodes) =>
    (nodes || []).reduce((acc, node) => {
      if (node.type in MEDIA_NODE_TYPES && !node.attrs?.src) return acc
      acc.push(node.content ? { ...node, content: clean(node.content) } : node)
      return acc
    }, [])

  return { ...doc, content: clean(doc.content) }
}

/**
 * A journal entry's text between the form, the stored fields and the reading
 * views (see CONTENT_FORMATS in src/services/journals.js).
 *
 * The form holds { format, rich, markdown }, as a recipe's instructions do; the
 * entry holds contentFormat, content and contentRich.
 */
import { markdownToRich } from './markdown'
import { isRichDoc, plainTextToRich, richDocIsEmpty, richToPlainText } from './richText'

export const EMPTY_CONTENT = { format: 'rich', rich: null, markdown: '' }

/**
 * The rich document is only trusted while it still matches its plain-text
 * mirror. A client from before the editor edits `content` alone and leaves the
 * document behind, and showing that stale document would hide the edit.
 */
function currentRichDoc(entry) {
  if (entry?.contentFormat !== 'rich' || !isRichDoc(entry.contentRich)) return null
  const mirror = (entry.content || '').trim()
  return richToPlainText(entry.contentRich).trim() === mirror ? entry.contentRich : null
}

/**
 * The form's value for a stored entry. An entry from before the editor opens in
 * the rich editor, its plain text carried over paragraph by paragraph.
 */
export function contentFromEntry(entry) {
  const text = entry?.content || ''
  if (entry?.contentFormat === 'markdown') return { format: 'markdown', rich: null, markdown: text }
  const doc = currentRichDoc(entry)
  if (doc) return { format: 'rich', rich: doc, markdown: '' }
  return { format: 'rich', rich: text.trim() ? plainTextToRich(text) : null, markdown: '' }
}

/**
 * The stored fields for the form's value. A rich entry keeps a plain-text mirror
 * in `content`, which the NAS export and older clients read; a Markdown one, its
 * source. `contentRich` is null when there is no document, which an edit turns
 * into a deleted field.
 */
export function contentToFields({ format, rich, markdown }) {
  if (format === 'markdown') {
    return { contentFormat: 'markdown', content: markdown.trim(), contentRich: null }
  }
  const hasDoc = !richDocIsEmpty(rich)
  return {
    contentFormat: 'rich',
    content: hasDoc ? richToPlainText(rich) : '',
    contentRich: hasDoc ? rich : null,
  }
}

export function contentIsEmpty({ format, rich, markdown }) {
  return format === 'markdown' ? !markdown.trim() : richDocIsEmpty(rich)
}

/**
 * The document to read an entry with, or null for plain text: an entry from
 * before either editor, or a rich one whose document did not decrypt or has
 * gone stale.
 */
export function entryDoc(entry) {
  if (entry?.contentFormat === 'markdown') return markdownToRich(entry.content || '')
  return currentRichDoc(entry)
}

/** The entry's words without their formatting, for the archive's previews. */
export function entryPlainText(entry) {
  if (entry?.contentFormat === 'markdown') return richToPlainText(markdownToRich(entry.content || ''))
  return entry?.content || ''
}

/** The entry's date as a Date: a Firestore Timestamp, or the demo's Date. */
export function entryDate(entry) {
  const d = entry?.date
  if (!d) return null
  if (typeof d.toDate === 'function') return d.toDate()
  if (typeof d.seconds === 'number') return new Date(d.seconds * 1000)
  return new Date(d)
}

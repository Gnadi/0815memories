/* A journal entry's text between the form, the stored fields and the reading
   views — above all for the entries written before the editor, which hold
   plain text and nothing else. */
import { describe, it, expect } from 'vitest'
import {
  contentFromEntry,
  contentIsEmpty,
  contentToFields,
  entryDate,
  entryDoc,
  entryPlainText,
} from '../utils/journalContent'

const doc = (...paragraphs) => ({
  type: 'doc',
  content: paragraphs.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
})

describe('an entry from before the editor', () => {
  const legacy = { title: 'First tooth', content: 'At dinner.\n\nIn a bite of apple.' }

  it('is read as the plain text it is', () => {
    expect(entryDoc(legacy)).toBeNull()
    expect(entryPlainText(legacy)).toBe(legacy.content)
  })

  it('opens in the rich editor with its paragraphs', () => {
    expect(contentFromEntry(legacy)).toEqual({
      format: 'rich', rich: doc('At dinner.', 'In a bite of apple.'), markdown: '',
    })
  })

  it('opens empty when it has no text', () => {
    expect(contentFromEntry({ content: '' })).toEqual({ format: 'rich', rich: null, markdown: '' })
  })
})

describe('a rich entry', () => {
  const rich = doc('Dear Emma,', 'today you rode alone.')
  const entry = { contentFormat: 'rich', contentRich: rich, content: 'Dear Emma,\n\ntoday you rode alone.' }

  it('is stored with a plain-text mirror', () => {
    expect(contentToFields({ format: 'rich', rich, markdown: '' })).toEqual({
      contentFormat: 'rich', content: 'Dear Emma,\n\ntoday you rode alone.', contentRich: rich,
    })
  })

  it('is read and edited as its document', () => {
    expect(entryDoc(entry)).toBe(rich)
    expect(contentFromEntry(entry)).toEqual({ format: 'rich', rich, markdown: '' })
  })

  it('falls back to its text when an older client changed the text alone', () => {
    const stale = { ...entry, content: 'Dear Emma, corrected.' }
    expect(entryDoc(stale)).toBeNull()
    expect(contentFromEntry(stale).rich).toEqual(doc('Dear Emma, corrected.'))
  })

  it('falls back to its text when the document did not decrypt', () => {
    expect(entryDoc({ ...entry, contentRich: 'b64ciphertext' })).toBeNull()
  })

  it('stores no document when nothing is written', () => {
    expect(contentToFields({ format: 'rich', rich: { type: 'doc', content: [{ type: 'paragraph' }] }, markdown: '' }))
      .toEqual({ contentFormat: 'rich', content: '', contentRich: null })
  })
})

describe('a Markdown entry', () => {
  const entry = { contentFormat: 'markdown', content: '## Day one\n\nYou were **brave**.' }

  it('keeps its source, and no document', () => {
    expect(contentToFields({ format: 'markdown', rich: null, markdown: `${entry.content}\n` }))
      .toEqual({ contentFormat: 'markdown', content: entry.content, contentRich: null })
    expect(contentFromEntry(entry)).toEqual({ format: 'markdown', rich: null, markdown: entry.content })
  })

  it('is read formatted and previewed without its marks', () => {
    expect(entryDoc(entry).content[0]).toMatchObject({ type: 'heading', attrs: { level: 2 } })
    expect(entryPlainText(entry)).toBe('Day one\n\nYou were brave.')
  })
})

it('an entry is empty until something is written', () => {
  expect(contentIsEmpty({ format: 'markdown', rich: null, markdown: '  ' })).toBe(true)
  expect(contentIsEmpty({ format: 'rich', rich: null, markdown: '' })).toBe(true)
  expect(contentIsEmpty({ format: 'rich', rich: doc('Hi'), markdown: '' })).toBe(false)
})

it('a date is read from a Timestamp, its seconds, or a Date', () => {
  const at = new Date('2024-10-18T00:00:00Z')
  expect(entryDate({ date: { toDate: () => at } })).toEqual(at)
  expect(entryDate({ date: { seconds: at.getTime() / 1000 } })).toEqual(at)
  expect(entryDate({ date: at })).toEqual(at)
  expect(entryDate({})).toBeNull()
})

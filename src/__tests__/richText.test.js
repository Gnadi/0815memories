import { describe, it, expect } from 'vitest'
import {
  EMPTY_RICH_DOC,
  isRichDoc,
  parseRichDoc,
  plainTextToRich,
  richToPlainText,
  richDocIsEmpty,
  collectRichMediaUrls,
  stripPendingMedia,
} from '../utils/richText'

const img = (src, caption) => ({ type: 'encryptedImage', attrs: { src, caption } })
const para = (text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })

describe('isRichDoc', () => {
  it('accepts only a parsed document', () => {
    expect(isRichDoc({ type: 'doc', content: [] })).toBe(true)
  })

  it('rejects strings, so an undecrypted field falls back instead of rendering', () => {
    // This is the guard behind MemoryBody's three-way fallback: the feed listener
    // deliberately leaves contentRich as ciphertext.
    expect(isRichDoc('kJ8xQ2+ciphertext==')).toBe(false)
    expect(isRichDoc('{"type":"doc","content":[]}')).toBe(false)
    expect(isRichDoc(null)).toBe(false)
    expect(isRichDoc(undefined)).toBe(false)
    expect(isRichDoc({ type: 'doc' })).toBe(false)
  })
})

describe('parseRichDoc', () => {
  it('parses a JSON document string', () => {
    expect(parseRichDoc('{"type":"doc","content":[]}')).toEqual({ type: 'doc', content: [] })
  })

  it('leaves a still-encrypted string untouched', () => {
    expect(parseRichDoc('kJ8xQ2+ciphertext==')).toBe('kJ8xQ2+ciphertext==')
  })

  it('leaves JSON that is not a document untouched', () => {
    expect(parseRichDoc('{"foo":1}')).toBe('{"foo":1}')
  })

  it('passes objects through', () => {
    const doc = { type: 'doc', content: [] }
    expect(parseRichDoc(doc)).toBe(doc)
  })
})

describe('plainTextToRich / richToPlainText', () => {
  it('round-trips multi-paragraph text', () => {
    const text = 'Der erste Absatz.\n\nDer zweite Absatz.'
    expect(richToPlainText(plainTextToRich(text))).toBe(text)
  })

  it('round-trips single newlines, which the old renderer dropped', () => {
    const text = 'Zeile eins\nZeile zwei\n\nNeuer Absatz'
    expect(richToPlainText(plainTextToRich(text))).toBe(text)
  })

  it('collapses runs of more than two newlines to one paragraph break', () => {
    expect(richToPlainText(plainTextToRich('a\n\n\n\nb'))).toBe('a\n\nb')
  })

  it('returns an empty document for empty input', () => {
    expect(plainTextToRich('')).toEqual(EMPTY_RICH_DOC)
    expect(plainTextToRich(undefined)).toEqual(EMPTY_RICH_DOC)
  })

  it('gives headings and list items their own lines', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Der Sommer' }] },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [para('Eis am Strand')] },
            { type: 'listItem', content: [para('Sonnenbrand')] },
          ],
        },
      ],
    }
    expect(richToPlainText(doc)).toBe('Der Sommer\n\nEis am Strand\n\nSonnenbrand')
  })

  it('flattens marks to their text', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'ganz ' },
            { type: 'text', text: 'wichtig', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    }
    expect(richToPlainText(doc)).toBe('ganz wichtig')
  })

  it('contributes a media caption but not the URL', () => {
    const doc = { type: 'doc', content: [para('Davor'), img('https://x/a', 'Oma am See')] }
    expect(richToPlainText(doc)).toBe('Davor\n\nOma am See')
  })

  it('ignores media without a caption', () => {
    const doc = { type: 'doc', content: [para('Davor'), img('https://x/a', '')] }
    expect(richToPlainText(doc)).toBe('Davor')
  })

  it('returns an empty string for anything that is not a document', () => {
    expect(richToPlainText('ciphertext')).toBe('')
    expect(richToPlainText(undefined)).toBe('')
  })
})

describe('richDocIsEmpty', () => {
  it('treats a blank document as empty', () => {
    expect(richDocIsEmpty(EMPTY_RICH_DOC)).toBe(true)
    expect(richDocIsEmpty(plainTextToRich('   '))).toBe(true)
    expect(richDocIsEmpty('ciphertext')).toBe(true)
  })

  it('does not treat a media-only document as empty', () => {
    expect(richDocIsEmpty({ type: 'doc', content: [img('https://x/a', '')] })).toBe(false)
  })
})

describe('collectRichMediaUrls', () => {
  it('finds every media asset in document order', () => {
    const doc = {
      type: 'doc',
      content: [
        img('https://x/a'),
        para('Text'),
        { type: 'encryptedVideo', attrs: { src: 'https://x/b' } },
        { type: 'encryptedAudio', attrs: { src: 'https://x/c' } },
      ],
    }
    expect(collectRichMediaUrls(doc)).toEqual([
      { kind: 'image', url: 'https://x/a' },
      { kind: 'video', url: 'https://x/b' },
      { kind: 'audio', url: 'https://x/c' },
    ])
  })

  it('skips nodes whose upload has not finished', () => {
    expect(collectRichMediaUrls({ type: 'doc', content: [img('')] })).toEqual([])
  })

  it('returns nothing for a non-document', () => {
    expect(collectRichMediaUrls('ciphertext')).toEqual([])
  })
})

describe('stripPendingMedia', () => {
  it('removes media nodes with no src and keeps the rest', () => {
    const doc = { type: 'doc', content: [para('Text'), img(''), img('https://x/a')] }
    expect(stripPendingMedia(doc)).toEqual({
      type: 'doc',
      content: [para('Text'), img('https://x/a')],
    })
  })

  it('reaches media nested inside a wrapper', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'blockquote', content: [img(''), para('bleibt')] }],
    }
    expect(stripPendingMedia(doc)).toEqual({
      type: 'doc',
      content: [{ type: 'blockquote', content: [para('bleibt')] }],
    })
  })

  it('leaves a non-document untouched', () => {
    expect(stripPendingMedia('ciphertext')).toBe('ciphertext')
  })
})

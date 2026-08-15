/* docs/media-performance.md §2 — the doc's own highest-rated item: "the single
   largest perceived-performance change available here".

   There was no blur-up placeholder for a structural reason. Cloudinary stores
   these as `raw` because it cannot transform ciphertext, so there is no
   server-side derivative to ask for and any preview costs a full round trip.
   The way out is for the preview to travel *inside* the document: a ~20px WebP
   is a few hundred bytes as base64 ciphertext, so it arrives and decrypts with
   the text fields the feed already decrypts, for zero requests. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { PLACEHOLDER_CLASSES } from '../components/media/placeholder'
import {
  tinyPreviewsFor,
  tinyPreviewAt,
  needsTinyPreviews,
  buildTinyPreviews,
} from '../utils/mediaThumbs'

const DATA_URL = 'data:image/webp;base64,AAAA'

describe('the thumbsTiny companion array', () => {
  // Same fail-safe contract as `thumbs`: positional, additive, and ignored
  // wholesale rather than risking a mismatched pairing.
  it('reads previews that line up with the images', () => {
    const doc = { images: ['a', 'b'], thumbsTiny: [DATA_URL, ''] }
    expect(tinyPreviewsFor(doc)).toEqual([DATA_URL, ''])
    expect(tinyPreviewAt(doc, 0)).toBe(DATA_URL)
    expect(tinyPreviewAt(doc, 1)).toBe('')
  })

  it('ignores an array of the wrong length entirely', () => {
    expect(tinyPreviewsFor({ images: ['a', 'b'], thumbsTiny: [DATA_URL] })).toEqual([])
    expect(tinyPreviewAt({ images: ['a', 'b'], thumbsTiny: [DATA_URL] }, 0)).toBe('')
  })

  it('ignores a document with no images', () => {
    expect(tinyPreviewsFor({ thumbsTiny: [DATA_URL] })).toEqual([])
  })

  it('reports a document needing backfill', () => {
    expect(needsTinyPreviews({ images: ['a'] })).toBe(true)
    expect(needsTinyPreviews({ images: ['a'], thumbsTiny: [DATA_URL] })).toBe(false)
    // No images is not "needs backfill".
    expect(needsTinyPreviews({ images: [] })).toBe(false)
  })

  it('builds the array to persist, or nothing at all', () => {
    expect(buildTinyPreviews([{ tinyPreview: DATA_URL }, {}])).toEqual([DATA_URL, ''])
    // All empty means leave the field off the document rather than write a row
    // of empty strings.
    expect(buildTinyPreviews([{}, {}])).toBeNull()
  })

  it('does not read or write the images array', () => {
    const images = ['a', 'b']
    tinyPreviewsFor({ images, thumbsTiny: [DATA_URL, DATA_URL] })
    expect(images).toEqual(['a', 'b'])
  })
})

// ── Rendering ───────────────────────────────────────────────────────
const media = { decryptedUrl: null, loading: true, ref: () => {} }
vi.mock('../components/media/useDecryptedMedia', () => ({
  default: () => media,
}))

const { default: EncryptedImage } = await import('../components/media/EncryptedImage')
const { default: EncryptedPhotoFrame } = await import('../components/media/EncryptedPhotoFrame')

beforeEach(() => {
  Object.assign(media, { decryptedUrl: null, loading: true, ref: () => {} })
})
afterEach(cleanup)

const imgs = () => Array.from(document.querySelectorAll('img'))

describe('EncryptedImage while the photo is still arriving', () => {
  it('paints the preview blurred instead of a grey placeholder', () => {
    render(<EncryptedImage src="https://cdn/a.enc" tinyPreview={DATA_URL} className="w-10" />)

    const preview = imgs().find((el) => el.getAttribute('src') === DATA_URL)
    expect(preview).toBeTruthy()
    expect(preview.style.filter).toContain('blur')
    // The shimmer must not sit on top of the preview.
    expect(document.querySelector(`.${PLACEHOLDER_CLASSES}`)).toBeNull()
  })

  it('hides the preview from assistive tech — it is the same photo', () => {
    render(<EncryptedImage src="https://cdn/a.enc" tinyPreview={DATA_URL} alt="Emma" />)
    const preview = imgs().find((el) => el.getAttribute('src') === DATA_URL)
    expect(preview.getAttribute('aria-hidden')).toBe('true')
  })

  it('falls back to the placeholder when there is no preview', () => {
    render(<EncryptedImage src="https://cdn/a.enc" className="w-10" />)
    expect(imgs()).toHaveLength(1)
    expect(imgs()[0].className).toContain(PLACEHOLDER_CLASSES)
  })

  it('drops the preview once the real photo has landed', () => {
    Object.assign(media, { decryptedUrl: 'blob:real', loading: false })
    render(<EncryptedImage src="https://cdn/a.enc" tinyPreview={DATA_URL} alt="Emma" />)

    expect(imgs()).toHaveLength(1)
    expect(imgs()[0].getAttribute('src')).toBe('blob:real')
  })

  it('renders nothing without a source, preview or not', () => {
    render(<EncryptedImage tinyPreview={DATA_URL} />)
    expect(imgs()).toHaveLength(0)
  })
})

describe('EncryptedPhotoFrame while the photo is still arriving', () => {
  it('points both existing layers at the preview, adding no element', () => {
    render(<EncryptedPhotoFrame src="https://cdn/a.enc" tinyPreview={DATA_URL} />)

    const rendered = imgs()
    expect(rendered).toHaveLength(2)
    for (const el of rendered) expect(el.getAttribute('src')).toBe(DATA_URL)
  })

  it('blurs the front layer so 20px does not read as a mistake', () => {
    render(<EncryptedPhotoFrame src="https://cdn/a.enc" tinyPreview={DATA_URL} />)
    expect(imgs()[1].style.filter).toContain('blur')
  })

  it('shows no spinner when it has the photo\'s own colours', () => {
    render(<EncryptedPhotoFrame src="https://cdn/a.enc" tinyPreview={DATA_URL} />)
    expect(document.querySelector(`.${PLACEHOLDER_CLASSES}`)).toBeNull()
  })

  it('keeps the spinner when there is no preview', () => {
    render(<EncryptedPhotoFrame src="https://cdn/a.enc" />)
    expect(imgs()[1].className).toContain(PLACEHOLDER_CLASSES)
  })

  it('swaps to the real photo and drops the blur', () => {
    Object.assign(media, { decryptedUrl: 'blob:real', loading: false })
    render(<EncryptedPhotoFrame src="https://cdn/a.enc" tinyPreview={DATA_URL} />)

    for (const el of imgs()) expect(el.getAttribute('src')).toBe('blob:real')
    expect(imgs()[1].style.filter).toBe('')
  })
})

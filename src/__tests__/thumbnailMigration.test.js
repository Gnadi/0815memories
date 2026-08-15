import { describe, it, expect, vi, beforeEach } from 'vitest'

const runTransaction = vi.fn()
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ name })),
  doc: vi.fn((_db, name, id) => ({ name, id })),
  getDocs: vi.fn(),
  limit: vi.fn((n) => ({ limit: n })),
  orderBy: vi.fn(),
  query: vi.fn((ref, ...c) => ({ ref, c })),
  runTransaction: (...args) => runTransaction(...args),
  startAfter: vi.fn(),
  where: vi.fn(),
}))
vi.mock('../config/firebase', () => ({ db: {} }))
vi.mock('../utils/encryption', () => ({
  decryptBlob: vi.fn(async () => new Blob(['original'])),
  encryptText: vi.fn(async (_k, text) => `enc:${text}`),
}))
vi.mock('../utils/imageThumbnail', () => ({ createThumbnail: vi.fn(), createTinyPreview: vi.fn() }))
vi.mock('../utils/encryptedUpload', () => ({ encryptAndUpload: vi.fn() }))
vi.mock('../utils/devLog', () => ({ devError: vi.fn(), devWarn: vi.fn() }))

import { getDocs } from 'firebase/firestore'
import { createThumbnail, createTinyPreview } from '../utils/imageThumbnail'
import { encryptAndUpload } from '../utils/encryptedUpload'
import {
  scanThumbnailStatus,
  commitThumbs,
  migrateDocument,
  migrateThumbnails,
} from '../utils/thumbnailMigration'

const KEY = { fake: 'key' }

function snapshot(docs) {
  return { empty: docs.length === 0, size: docs.length, docs: docs.map((d) => ({ id: d.id, data: () => d })) }
}

beforeEach(() => {
  vi.clearAllMocks()
  // mockReset, not clearAllMocks: a leftover `once` queue from a previous test
  // would be answered before this test's own.
  getDocs.mockReset()
  globalThis.fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }))
  createThumbnail.mockResolvedValue(new Blob(['thumb'], { type: 'image/webp' }))
  encryptAndUpload.mockImplementation(async () => ({ url: 'https://cdn/thumb.enc', publicId: 'p' }))
})

describe('scanThumbnailStatus', () => {
  it('selects only documents with images and no usable thumbs', async () => {
    getDocs.mockResolvedValueOnce(snapshot([
      { id: 'needs', images: ['a.enc', 'b.enc'] },
      { id: 'done', images: ['c.enc'], thumbs: ['c-t.enc'], thumbsTiny: ['tiny'] },
      { id: 'mismatched', images: ['d.enc', 'e.enc'], thumbs: ['d-t.enc'], thumbsTiny: ['x', 'y'] },
      { id: 'no-images', images: [] },
    ]))

    const { total, pending } = await scanThumbnailStatus('fam1', ['memories'])

    // 'no-images' counts for nothing at all — there is nothing to optimise.
    expect(total).toBe(3)
    expect(pending.map((p) => p.id)).toEqual(['needs', 'mismatched'])
    expect(pending[0]).toMatchObject({ collectionName: 'memories', images: ['a.enc', 'b.enc'] })
  })

  it('reports nothing pending once every document is done', async () => {
    getDocs.mockResolvedValueOnce(snapshot([
      { id: 'done', images: ['c.enc'], thumbs: ['c-t.enc'], thumbsTiny: ['tiny'] },
    ]))

    const { total, pending } = await scanThumbnailStatus('fam1', ['memories'])
    expect(total).toBe(1)
    expect(pending).toEqual([])
  })

  it('returns an empty result without a family', async () => {
    expect(await scanThumbnailStatus(null)).toEqual({ total: 0, pending: [] })
    expect(getDocs).not.toHaveBeenCalled()
  })
})

describe('commitThumbs', () => {
  function withStoredDoc(stored) {
    const update = vi.fn()
    runTransaction.mockImplementation(async (_db, fn) =>
      fn({ get: async () => ({ exists: () => stored !== null, data: () => stored }), update })
    )
    return update
  }

  it('writes only the thumbs field', async () => {
    const update = withStoredDoc({ images: ['a.enc'], title: 'secret', familyId: 'fam1' })

    expect(await commitThumbs('memories', 'm1', ['a.enc'], ['a-t.enc'])).toBe(true)
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][1]).toEqual({ thumbs: ['a-t.enc'] })
  })

  it('writes nothing when images changed under us', async () => {
    const update = withStoredDoc({ images: ['a.enc', 'NEW.enc'] })

    expect(await commitThumbs('memories', 'm1', ['a.enc'], ['a-t.enc'])).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  it('writes nothing when the images were reordered', async () => {
    const update = withStoredDoc({ images: ['b.enc', 'a.enc'] })

    expect(await commitThumbs('memories', 'm1', ['a.enc', 'b.enc'], ['a-t.enc', 'b-t.enc'])).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  it('writes nothing when another run already filled it in', async () => {
    const update = withStoredDoc({ images: ['a.enc'], thumbs: ['already.enc'] })

    expect(await commitThumbs('memories', 'm1', ['a.enc'], ['a-t.enc'])).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  it('writes nothing when the document is gone', async () => {
    const update = withStoredDoc(null)

    expect(await commitThumbs('memories', 'm1', ['a.enc'], ['a-t.enc'])).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })
})

describe('migrateDocument', () => {
  beforeEach(() => {
    runTransaction.mockImplementation(async (_db, fn) =>
      fn({ get: async () => ({ exists: () => true, data: () => ({ images: ['a.enc', 'b.enc'] }) }), update: vi.fn() })
    )
  })

  it('keeps thumbs positionally aligned when one image yields nothing', async () => {
    createThumbnail.mockResolvedValueOnce(null)
    let written
    runTransaction.mockImplementation(async (_db, fn) =>
      fn({
        get: async () => ({ exists: () => true, data: () => ({ images: ['a.enc', 'b.enc'] }) }),
        update: (_ref, data) => { written = data },
      })
    )

    await migrateDocument({ collectionName: 'memories', id: 'm1', images: ['a.enc', 'b.enc'] }, KEY)

    expect(written.thumbs).toHaveLength(2)
    expect(written.thumbs[0]).toBe('')
    expect(written.thumbs[1]).toBe('https://cdn/thumb.enc')
  })

  it('records an empty slot rather than failing when one image cannot be fetched', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 404 }))
    let written
    runTransaction.mockImplementation(async (_db, fn) =>
      fn({
        get: async () => ({ exists: () => true, data: () => ({ images: ['a.enc'] }) }),
        update: (_ref, data) => { written = data },
      })
    )

    await migrateDocument({ collectionName: 'memories', id: 'm1', images: ['a.enc'] }, KEY)

    // Marked as considered, so a rescan does not queue it forever.
    expect(written.thumbs).toEqual([''])
  })
})

describe('migrateThumbnails', () => {
  beforeEach(() => {
    runTransaction.mockImplementation(async (_db, fn) =>
      fn({ get: async () => ({ exists: () => true, data: () => ({ images: ['a.enc'] }) }), update: vi.fn() })
    )
  })

  const items = ['m1', 'm2', 'm3'].map((id) => ({ collectionName: 'memories', id, images: ['a.enc'] }))

  it('reports progress for each document', async () => {
    const seen = []
    const result = await migrateThumbnails(items, KEY, { onProgress: (d, t) => seen.push([d, t]) })

    expect(seen).toEqual([[1, 3], [2, 3], [3, 3]])
    expect(result).toEqual({ done: 3, written: 3, stopped: false })
  })

  it('stops between documents when asked, without losing what is finished', async () => {
    let calls = 0
    const result = await migrateThumbnails(items, KEY, { shouldStop: () => calls++ >= 2 })

    expect(result.stopped).toBe(true)
    expect(result.done).toBe(2)
  })

  it('carries on past a document that fails', async () => {
    let call = 0
    encryptAndUpload.mockImplementation(async () => {
      if (++call === 2) throw new Error('upload failed')
      return { url: 'https://cdn/thumb.enc', publicId: 'p' }
    })

    const result = await migrateThumbnails(items, KEY, {})
    expect(result.done).toBe(3)
    expect(result.stopped).toBe(false)
  })
})

/* docs/media-performance.md §2. The blur-up preview is built from the same
   decrypted original as the thumbnail, so the backfill does both in one visit
   rather than downloading every photo twice. */
describe('the blur-up preview backfill', () => {
  const DATA_URL = 'data:image/webp;base64,AAAA'

  beforeEach(() => {
    createTinyPreview.mockResolvedValue(DATA_URL)
  })

  it('selects a document that has thumbnails but no previews', async () => {
    getDocs.mockResolvedValueOnce(snapshot([
      { id: 'half-done', images: ['a.enc'], thumbs: ['a-t.enc'] },
    ]))

    const { pending } = await scanThumbnailStatus('fam1', ['memories'])

    expect(pending).toHaveLength(1)
    // It only needs the half it is missing.
    expect(pending[0]).toMatchObject({ wantThumbs: false, wantTiny: true })
  })

  it('stores the preview encrypted on the document rather than uploading it', async () => {
    const item = { collectionName: 'memories', id: 'm1', images: ['a.enc'], wantThumbs: false, wantTiny: true }
    const update = vi.fn()
    runTransaction.mockImplementation(async (_db, fn) =>
      fn({ get: async () => ({ exists: () => true, data: () => ({ images: ['a.enc'] }) }), update }),
    )

    await migrateDocument(item, KEY)

    expect(update.mock.calls[0][1]).toEqual({ thumbsTiny: [`enc:${DATA_URL}`] })
    // The whole point: no second asset on Cloudinary.
    expect(encryptAndUpload).not.toHaveBeenCalled()
  })

  it('downloads the original once when both derivatives are missing', async () => {
    const item = { collectionName: 'memories', id: 'm1', images: ['a.enc'], wantThumbs: true, wantTiny: true }
    runTransaction.mockImplementation(async (_db, fn) =>
      fn({ get: async () => ({ exists: () => true, data: () => ({ images: ['a.enc'] }) }), update: vi.fn() }),
    )

    await migrateDocument(item, KEY)

    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('keeps the thumbnail when only the preview fails', async () => {
    // These used to share one try/catch, so a failing preview lost the
    // thumbnail that had already been uploaded.
    createTinyPreview.mockRejectedValue(new Error('encode failed'))
    const item = { collectionName: 'memories', id: 'm1', images: ['a.enc'], wantThumbs: true, wantTiny: true }
    const update = vi.fn()
    runTransaction.mockImplementation(async (_db, fn) =>
      fn({ get: async () => ({ exists: () => true, data: () => ({ images: ['a.enc'] }) }), update }),
    )

    await migrateDocument(item, KEY)

    expect(update.mock.calls[0][1].thumbs).toEqual(['https://cdn/thumb.enc'])
  })

  it('writes only the field that is missing', async () => {
    const item = { collectionName: 'memories', id: 'm1', images: ['a.enc'], wantThumbs: false, wantTiny: true }
    const update = vi.fn()
    runTransaction.mockImplementation(async (_db, fn) =>
      fn({
        // Thumbs already present: leave them alone.
        get: async () => ({ exists: () => true, data: () => ({ images: ['a.enc'], thumbs: ['a-t.enc'] }) }),
        update,
      }),
    )

    await migrateDocument(item, KEY)

    expect(update.mock.calls[0][1]).not.toHaveProperty('thumbs')
    expect(update.mock.calls[0][1]).toHaveProperty('thumbsTiny')
  })
})

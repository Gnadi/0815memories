/* The Black Box shipped with ENCRYPTED_FIELDS = ['content'] while the create
   page wrote 'message', so encryptFields silently skipped it and every capsule
   was stored in plaintext. These cover the repair: finding those capsules,
   encrypting them, and refusing to write over a concurrent edit. */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const runTransaction = vi.fn()
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ name })),
  deleteField: vi.fn(() => '__DELETE__'),
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
vi.mock('../utils/devLog', () => ({ devError: vi.fn(), devWarn: vi.fn() }))

// A stand-in for the real crypto: anything prefixed with "enc:" is ciphertext,
// and decryptText returns its input unchanged when it cannot decrypt — which is
// the real function's documented behaviour for pre-encryption data, and the
// signal the scan relies on.
vi.mock('../utils/encryption', () => ({
  encryptText: vi.fn(async (_key, plaintext) => `enc:${plaintext}`),
  decryptText: vi.fn(async (_key, value) =>
    value.startsWith('enc:') ? value.slice(4) : value,
  ),
}))

import { getDocs } from 'firebase/firestore'
import {
  scanBlackboxEncryption,
  migrateBlackboxDocument,
  migrateBlackboxEncryption,
} from '../utils/blackboxMigration'

const KEY = { fake: 'key' }

function snapshot(docs) {
  return {
    empty: docs.length === 0,
    size: docs.length,
    docs: docs.map((d) => ({ id: d.id, data: () => d })),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getDocs.mockReset()
})

describe('scanBlackboxEncryption', () => {
  it('selects capsules whose fields are still plaintext', async () => {
    getDocs.mockResolvedValueOnce(
      snapshot([
        { id: 'plain', familyId: 'fam1', title: 'For Emma', message: 'When you turn 18…' },
        // Encrypted *and* already split — no inline payload left to move.
        { id: 'done', familyId: 'fam1', title: 'enc:For Ben' },
      ]),
    )

    const { total, pending } = await scanBlackboxEncryption('fam1', KEY)

    expect(total).toBe(2)
    expect(pending).toHaveLength(1)
    expect(pending[0].id).toBe('plain')
    // The exact plaintext is carried forward so the commit can detect an edit.
    expect(pending[0].plain).toEqual({ title: 'For Emma', message: 'When you turn 18…' })
  })

  it('selects a half-encrypted capsule, and only its plaintext field', async () => {
    getDocs.mockResolvedValueOnce(
      snapshot([{ id: 'half', familyId: 'fam1', title: 'enc:For Emma', message: 'still plain' }]),
    )

    const { pending } = await scanBlackboxEncryption('fam1', KEY)

    expect(pending).toHaveLength(1)
    expect(pending[0].plain).toEqual({ message: 'still plain' })
  })

  it('carries the inline payload forward, decrypted, ready to re-encrypt', async () => {
    getDocs.mockResolvedValueOnce(
      snapshot([
        {
          id: 'split-me',
          familyId: 'fam1',
          title: 'enc:T',
          message: 'enc:Hi',
          photos: ['u1'],
        },
      ]),
    )

    const { pending } = await scanBlackboxEncryption('fam1', KEY)

    expect(pending).toHaveLength(1)
    // Nothing to encrypt — it is already ciphertext — but it still needs moving.
    expect(pending[0].plain).toEqual({})
    expect(pending[0].payload).toEqual({
      message: 'Hi',
      photos: ['u1'],
      videos: [],
      voiceNote: null,
    })
  })

  it('selects a capsule whose only inline payload is media', async () => {
    getDocs.mockResolvedValueOnce(
      snapshot([{ id: 'photos-only', familyId: 'fam1', title: 'enc:T', photos: ['u1'] }]),
    )

    const { pending } = await scanBlackboxEncryption('fam1', KEY)

    expect(pending).toHaveLength(1)
    expect(pending[0].payload.photos).toEqual(['u1'])
    expect(pending[0].payload.message).toBe('')
  })

  it('ignores absent and empty fields rather than trying to encrypt them', async () => {
    getDocs.mockResolvedValueOnce(
      snapshot([{ id: 'sparse', familyId: 'fam1', title: '', message: null }]),
    )

    const { total, pending } = await scanBlackboxEncryption('fam1', KEY)

    expect(total).toBe(1)
    expect(pending).toHaveLength(0)
  })

  it('returns nothing without a family or a key, rather than reading', async () => {
    expect(await scanBlackboxEncryption(null, KEY)).toEqual({ total: 0, pending: [] })
    expect(await scanBlackboxEncryption('fam1', null)).toEqual({ total: 0, pending: [] })
    expect(getDocs).not.toHaveBeenCalled()
  })

  it('pages until a short page, so a large vault is not one unbounded read', async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({ id: `a${i}`, message: 'plain' }))
    getDocs
      .mockResolvedValueOnce(snapshot(full))
      .mockResolvedValueOnce(snapshot([{ id: 'last', message: 'plain' }]))

    const { total, pending } = await scanBlackboxEncryption('fam1', KEY)

    expect(getDocs).toHaveBeenCalledTimes(2)
    expect(total).toBe(101)
    expect(pending).toHaveLength(101)
  })
})

describe('migrateBlackboxDocument', () => {
  function txWith(current) {
    return async (_db, fn) =>
      fn({
        get: async () => ({ exists: () => current !== null, data: () => current }),
        update: vi.fn((ref, data) => {
          txWith.lastWrite = { ref, data }
        }),
        set: vi.fn((ref, data) => {
          txWith.lastSet = { ref, data }
        }),
      })
  }

  beforeEach(() => {
    txWith.lastWrite = undefined
    txWith.lastSet = undefined
  })

  it('writes ciphertext for exactly the fields it is repairing', async () => {
    runTransaction.mockImplementation(txWith({ title: 'For Emma', message: 'Hi', childId: 'k1' }))

    const written = await migrateBlackboxDocument(
      { id: 'b1', plain: { title: 'For Emma', message: 'Hi' } },
      KEY,
    )

    expect(written).toBe(true)
    expect(txWith.lastWrite.data).toEqual({ title: 'enc:For Emma', message: 'enc:Hi' })
    // childId is untouched — the repair is not an excuse to rewrite the document.
    expect(txWith.lastWrite.data).not.toHaveProperty('childId')
  })

  it('discards the write when a field changed under it', async () => {
    runTransaction.mockImplementation(txWith({ title: 'For Emma', message: 'edited since' }))

    const written = await migrateBlackboxDocument(
      { id: 'b1', plain: { title: 'For Emma', message: 'Hi' } },
      KEY,
    )

    expect(written).toBe(false)
    expect(txWith.lastWrite).toBeUndefined()
  })

  it('discards the write when another tab already encrypted the capsule', async () => {
    runTransaction.mockImplementation(txWith({ title: 'enc:For Emma', message: 'enc:Hi' }))

    const written = await migrateBlackboxDocument(
      { id: 'b1', plain: { title: 'For Emma', message: 'Hi' } },
      KEY,
    )

    expect(written).toBe(false)
  })

  it('does nothing for a capsule deleted since the scan', async () => {
    runTransaction.mockImplementation(txWith(null))

    expect(
      await migrateBlackboxDocument({ id: 'gone', plain: { message: 'Hi' } }, KEY),
    ).toBe(false)
  })

  it('moves an inline payload to the content document and clears the original', async () => {
    runTransaction.mockImplementation(
      txWith({ familyId: 'fam1', title: 'enc:T', message: 'enc:Hi', photos: ['u1'] }),
    )

    const written = await migrateBlackboxDocument(
      {
        id: 'b1',
        familyId: 'fam1',
        plain: {},
        payload: { message: 'Hi', photos: ['u1'], videos: [], voiceNote: null },
      },
      KEY,
    )

    expect(written).toBe(true)
    // The letter lands on the sealed document, encrypted, carrying the familyId
    // its read rule needs.
    expect(txWith.lastSet.ref).toEqual({ name: 'blackboxContent', id: 'b1' })
    expect(txWith.lastSet.data).toEqual({
      message: 'enc:Hi',
      photos: ['u1'],
      videos: [],
      voiceNote: null,
      familyId: 'fam1',
    })
    // And every inline copy is removed, or the seal would be bypassable.
    expect(txWith.lastWrite.data).toEqual({
      message: '__DELETE__',
      photos: '__DELETE__',
      videos: '__DELETE__',
      voiceNote: '__DELETE__',
    })
  })

  it('encrypts and splits in a single write when a capsule needs both', async () => {
    runTransaction.mockImplementation(
      txWith({ familyId: 'fam1', title: 'For Emma', message: 'Hi' }),
    )

    const written = await migrateBlackboxDocument(
      {
        id: 'b1',
        familyId: 'fam1',
        plain: { title: 'For Emma', message: 'Hi' },
        payload: { message: 'Hi', photos: [], videos: [], voiceNote: null },
      },
      KEY,
    )

    expect(written).toBe(true)
    expect(txWith.lastSet.data.message).toBe('enc:Hi')
    // title is encrypted in place; the payload fields are cleared.
    expect(txWith.lastWrite.data.title).toBe('enc:For Emma')
    expect(txWith.lastWrite.data.message).toBe('__DELETE__')
  })

  it('stands down when another tab already split the capsule', async () => {
    // Payload gone from the metadata document: the content document is now
    // authoritative and must not be overwritten from a stale scan.
    runTransaction.mockImplementation(txWith({ familyId: 'fam1', title: 'enc:T' }))

    const written = await migrateBlackboxDocument(
      {
        id: 'b1',
        familyId: 'fam1',
        plain: {},
        payload: { message: 'Hi', photos: [], videos: [], voiceNote: null },
      },
      KEY,
    )

    expect(written).toBe(false)
    expect(txWith.lastSet).toBeUndefined()
  })

  it('leaves an already-split capsule alone', async () => {
    runTransaction.mockImplementation(txWith({ familyId: 'fam1', title: 'For Emma' }))

    const written = await migrateBlackboxDocument(
      { id: 'b1', familyId: 'fam1', plain: { title: 'For Emma' }, payload: null },
      KEY,
    )

    expect(written).toBe(true)
    expect(txWith.lastSet).toBeUndefined()
    expect(txWith.lastWrite.data).toEqual({ title: 'enc:For Emma' })
  })
})

describe('migrateBlackboxEncryption', () => {
  it('reports progress per capsule and counts only real writes', async () => {
    runTransaction
      .mockImplementationOnce(async (_db, fn) =>
        fn({ get: async () => ({ exists: () => true, data: () => ({ message: 'a' }) }), update: vi.fn() }),
      )
      .mockImplementationOnce(async (_db, fn) =>
        fn({ get: async () => ({ exists: () => false, data: () => null }), update: vi.fn() }),
      )

    const seen = []
    const result = await migrateBlackboxEncryption(
      [{ id: '1', plain: { message: 'a' } }, { id: '2', plain: { message: 'b' } }],
      KEY,
      { onProgress: (done, total) => seen.push([done, total]) },
    )

    expect(result).toEqual({ done: 2, written: 1, stopped: false })
    expect(seen).toEqual([[1, 2], [2, 2]])
  })

  it('stops between capsules when asked', async () => {
    runTransaction.mockImplementation(async (_db, fn) =>
      fn({ get: async () => ({ exists: () => true, data: () => ({ message: 'a' }) }), update: vi.fn() }),
    )

    const result = await migrateBlackboxEncryption(
      [{ id: '1', plain: { message: 'a' } }, { id: '2', plain: { message: 'a' } }],
      KEY,
      { shouldStop: () => true },
    )

    expect(result).toEqual({ done: 0, written: 0, stopped: true })
    expect(runTransaction).not.toHaveBeenCalled()
  })

  it('keeps going when one capsule throws', async () => {
    runTransaction
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(async (_db, fn) =>
        fn({ get: async () => ({ exists: () => true, data: () => ({ message: 'b' }) }), update: vi.fn() }),
      )

    const result = await migrateBlackboxEncryption(
      [{ id: '1', plain: { message: 'a' } }, { id: '2', plain: { message: 'b' } }],
      KEY,
    )

    expect(result).toEqual({ done: 2, written: 1, stopped: false })
  })
})

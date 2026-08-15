/* The Black Box shipped with ENCRYPTED_FIELDS = ['content'] while the create
   page wrote 'message', so encryptFields silently skipped it and every capsule
   was stored in plaintext. These cover the repair: finding those capsules,
   encrypting them, and refusing to write over a concurrent edit. */
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
        { id: 'plain', title: 'For Emma', message: 'When you turn 18…' },
        { id: 'done', title: 'enc:For Ben', message: 'enc:Hello' },
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
      snapshot([{ id: 'half', title: 'enc:For Emma', message: 'still plain' }]),
    )

    const { pending } = await scanBlackboxEncryption('fam1', KEY)

    expect(pending).toHaveLength(1)
    expect(pending[0].plain).toEqual({ message: 'still plain' })
  })

  it('ignores absent and empty fields rather than trying to encrypt them', async () => {
    getDocs.mockResolvedValueOnce(snapshot([{ id: 'sparse', title: '', message: null }]))

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
      })
  }

  beforeEach(() => { txWith.lastWrite = undefined })

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

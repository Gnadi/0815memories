/**
 * The text of a moment — caption, location, category and label — is encrypted
 * like a memory's (src/services/moments.js). Until November 2026 it was not, so
 * the reader has to tell an encrypted moment from one written before, by its
 * `textEncrypted` mark, and every write has to leave a moment either wholly in
 * clear or wholly encrypted and marked.
 *
 * Real crypto: a stub would not show that what is stored decrypts to the text.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { webcrypto } from 'node:crypto'

const addDoc = vi.fn(async () => ({ id: 'new' }))
const updateDoc = vi.fn(async () => {})
const batchSet = vi.fn()
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ name })),
  doc: vi.fn((_db, name, id) => ({ name, id })),
  addDoc: (...a) => addDoc(...a),
  updateDoc: (...a) => updateDoc(...a),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  deleteField: vi.fn(() => 'DELETE_FIELD'),
  writeBatch: vi.fn(() => ({ set: batchSet, delete: vi.fn(), commit: vi.fn(async () => {}) })),
}))
vi.mock('../config/firebase', () => ({ db: {}, auth: null }))

import { clearDecryptedTextCache, decryptText, encryptText, generateEncryptionKey } from '../utils/encryption'
import { addMoment, decryptMoment, updateMoment } from '../services/moments'
import { convertMemoryToMoment } from '../services/memories'

beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
  }
})

let key
beforeEach(async () => {
  vi.clearAllMocks()
  clearDecryptedTextCache()
  if (!key) ({ key } = await generateEncryptionKey())
})

const TEXT = { caption: 'Picnic at the lake', location: 'Lake Tegernsee', category: 'Family', label: '' }
const IMAGE = 'https://res.cloudinary.com/demo/raw/upload/v1/kaydo/fam-1/0123456789abcdef0123456789abcdef'

async function expectEncrypted(stored, text = TEXT) {
  expect(stored.textEncrypted).toBe(true)
  for (const [field, value] of Object.entries(text)) {
    expect(stored[field]).not.toBe(value)
    expect(await decryptText(key, stored[field])).toBe(value)
  }
}

describe('writing a moment', () => {
  it('encrypts its text and marks it', async () => {
    await addMoment('fam-1', key, { ...TEXT, images: [IMAGE] })
    const [, stored] = addDoc.mock.calls[0]
    await expectEncrypted(stored)
    // The media and what the ledger needs stay as they were.
    expect(stored.images).toEqual([IMAGE])
    expect(stored.mediaRefs.images).toEqual(['kaydo/fam-1/0123456789abcdef0123456789abcdef'])
    expect(stored.familyId).toBe('fam-1')
  })

  it('encrypts an edit, which marks a moment from before as well', async () => {
    await updateMoment(key, 'm1', { ...TEXT, caption: 'Picnic, later', images: [IMAGE] })
    const [ref, stored] = updateDoc.mock.calls[0]
    expect(ref).toEqual({ name: 'moments', id: 'm1' })
    await expectEncrypted(stored, { ...TEXT, caption: 'Picnic, later' })
  })

  it('leaves the text and the mark alone in an edit without text', async () => {
    await updateMoment(key, 'm1', { images: [IMAGE] })
    const [, stored] = updateDoc.mock.calls[0]
    expect(stored).not.toHaveProperty('textEncrypted')
    expect(stored).not.toHaveProperty('caption')
  })

  it('refuses an edit with only part of the text, and writes nothing', async () => {
    // It would leave the rest of a moment from before in clear behind the mark.
    await expect(updateMoment(key, 'm1', { caption: 'Picnic' })).rejects.toThrow('as a whole')
    expect(updateDoc).not.toHaveBeenCalled()
  })

  it('refuses to write without the family key', async () => {
    await expect(addMoment('fam-1', null, { ...TEXT })).rejects.toThrow()
    expect(addDoc).not.toHaveBeenCalled()
  })

  it('encrypts the text of a memory turned into a moment', async () => {
    await convertMemoryToMoment('fam-1', key, 'mem-1', { ...TEXT, images: [IMAGE] }, 'DATE')
    const [, stored] = batchSet.mock.calls[0]
    await expectEncrypted(stored)
    expect(stored.date).toBe('DATE')
  })
})

describe('reading a moment', () => {
  it('decrypts the text of a marked moment', async () => {
    const stored = { id: 'm1', textEncrypted: true, images: [IMAGE] }
    for (const [field, value] of Object.entries(TEXT)) stored[field] = await encryptText(key, value)
    expect(await decryptMoment(key, stored)).toMatchObject({ ...TEXT, textEncrypted: true })
  })

  it('shows the text of a moment from before as it is', async () => {
    const stored = { id: 'm1', ...TEXT, images: [IMAGE] }
    expect(await decryptMoment(key, stored)).toEqual(stored)
  })

  it('names a field that does not decrypt instead of showing it', async () => {
    const stored = { id: 'm1', textEncrypted: true, caption: 'not ciphertext at all', images: [IMAGE] }
    const moment = await decryptMoment(key, stored)
    expect(moment.caption).toBeNull()
    expect(moment.unreadableFields).toEqual(['caption'])
  })
})

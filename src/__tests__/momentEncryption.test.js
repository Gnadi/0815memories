/**
 * A moment's text is encrypted when it is written — services/moments.js.
 *
 * Moments kept caption, category, location and label in clear, and a memory
 * turned into a moment landed that way too. New and edited moments now encrypt
 * them and carry `textEncrypted: true`; the ones from before are not migrated,
 * so a write that touches no text leaves them, and their flag, alone.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { webcrypto } from 'node:crypto'

const writes = vi.hoisted(() => [])
vi.mock('../config/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'uid-a' } } }))
vi.mock('../config/firestore', () => ({
  collection: (_db, name) => ({ name }),
  // doc(collection(…)) for a new id, doc(db, name, id) for an existing one.
  doc: (first, name, id) => (name === undefined ? { name: first.name, id: 'new-id' } : { name, id }),
  addDoc: async (ref, data) => { writes.push(['add', ref.name, data]); return { id: 'new-id' } },
  updateDoc: async (ref, data) => { writes.push(['update', ref.name, data]) },
  deleteDoc: vi.fn(),
  writeBatch: () => ({
    set: (ref, data) => writes.push(['set', ref.name, data]),
    delete: (ref) => writes.push(['delete', ref.name]),
    commit: async () => {},
  }),
  serverTimestamp: () => 'SERVER_TIME',
  deleteField: () => ({ kind: 'deleteField' }),
  query: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(), onSnapshot: vi.fn(),
}))

import { generateEncryptionKey, decryptText } from '../utils/encryption'
import { addMoment, decryptMoment, updateMoment } from '../services/moments'
import { convertMemoryToMoment } from '../services/memories'

let key
beforeAll(async () => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
  }
  ;({ key } = await generateEncryptionKey())
})
beforeEach(() => { writes.length = 0 })

const FORM = { caption: 'Beach day', category: 'Travel', location: 'Monterey', label: '' }
const TEXT = Object.keys(FORM)

async function expectEncrypted(data) {
  expect(data.textEncrypted).toBe(true)
  for (const field of TEXT) {
    expect(data[field]).not.toBe(FORM[field])
    expect(await decryptText(key, data[field])).toBe(FORM[field])
  }
}

describe('writing a moment', () => {
  it('stores a new moment with its text encrypted and flagged', async () => {
    await addMoment('fam-1', key, { ...FORM, images: ['a.enc'] })
    const [[, collection, data]] = writes
    expect(collection).toBe('moments')
    await expectEncrypted(data)
    expect(data.images).toEqual(['a.enc'])
  })

  it('encrypts an edit, which turns a moment from before into an encrypted one', async () => {
    await updateMoment(key, 'm1', { ...FORM, images: ['a.enc'] })
    await expectEncrypted(writes[0][2])
  })

  it('leaves the flag off a write that carries no text', async () => {
    await updateMoment(key, 'm1', { thumbs: ['t.enc'] })
    const [[, , data]] = writes
    expect(data.thumbs).toEqual(['t.enc'])
    expect(data).not.toHaveProperty('textEncrypted')
    for (const field of TEXT) expect(data).not.toHaveProperty(field)
  })

  it('encrypts the text of a memory turned into a moment', async () => {
    await convertMemoryToMoment('fam-1', key, 'mem-1', { ...FORM, images: ['a.enc'] }, 'DATE')
    const set = writes.find(([op]) => op === 'set')
    expect(set[1]).toBe('moments')
    await expectEncrypted(set[2])
    expect(writes).toContainEqual(['delete', 'memories'])
  })
})

describe('reading a moment', () => {
  it('reads back what was written', async () => {
    await addMoment('fam-1', key, { ...FORM, images: ['a.enc'] })
    expect(await decryptMoment(key, writes[0][2])).toMatchObject(FORM)
  })

  it('shows the plaintext of a moment from before as it is', async () => {
    const old = { ...FORM, images: ['a.enc'] }
    expect(await decryptMoment(key, old)).toEqual(old)
  })
})

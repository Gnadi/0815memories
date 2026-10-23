/**
 * Writing `mediaRefs` onto older documents — src/services/mediaIndex.js.
 *
 * It runs in the admin's browser because only there can rich text be read, and
 * it writes the whole map, so what matters is that the map comes from the
 * decrypted document, that an unchanged one is left alone, and that what the
 * rules refuse is skipped rather than failing the run.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = vi.hoisted(() => ({ docs: new Map(), updates: [], denied: new Set() }))

vi.mock('../config/firebase', () => ({ db: {} }))
vi.mock('../config/firestore', () => ({
  collection: (_db, name) => ({ name }),
  where: (field, op, value) => ({ field, op, value }),
  query: (ref, ...filters) => ({ name: ref.name, filters }),
  doc: (_db, name, id) => ({ name, id, path: `${name}/${id}` }),
  getDocs: async (q) => ({
    docs: [...store.docs]
      .filter(([path]) => path.startsWith(`${q.name}/`))
      .map(([path, data]) => ({ id: path.split('/')[1], data: () => data })),
  }),
  getDoc: async (ref) => ({ exists: () => store.docs.has(ref.path), data: () => store.docs.get(ref.path) }),
  runTransaction: async (_db, fn) => fn({
    get: async (ref) => {
      if (store.denied.has(ref.path)) throw Object.assign(new Error('denied'), { code: 'permission-denied' })
      return { exists: () => store.docs.has(ref.path), data: () => store.docs.get(ref.path) }
    },
    update: (ref, data) => { store.updates.push([ref.path, data]) },
  }),
  updateDoc: async (ref, data) => { store.updates.push([ref.path, data]) },
  serverTimestamp: () => 'SERVER_TIME',
  deleteField: () => ({ kind: 'deleteField' }),
  // Imported by the services this one reads through; not called here.
  addDoc: vi.fn(), deleteDoc: vi.fn(), getCountFromServer: vi.fn(), limit: vi.fn(), onSnapshot: vi.fn(),
  orderBy: vi.fn(), setDoc: vi.fn(), startAfter: vi.fn(), writeBatch: vi.fn(), arrayUnion: vi.fn(),
  arrayRemove: vi.fn(), Timestamp: { fromDate: vi.fn() },
}))
// Stands in for the family key: "decrypting" a memory's rich text parses it.
vi.mock('../services/memories', () => ({
  decryptMemoryDoc: async (_key, data) => ({ ...data, contentRich: data.contentRich ? JSON.parse(data.contentRich.slice(4)) : null }),
}))

import { indexDocument, indexFamilyMedia, scanMediaDocuments } from '../services/mediaIndex'

const LEGACY_URL = 'https://res.cloudinary.com/demo/raw/upload/v1/kaydo/encrypted/old1.dat'
const NEW_ID = `kaydo/fam-1/${'a'.repeat(32)}`
const sealed = (doc) => `enc:${JSON.stringify(doc)}`

beforeEach(() => {
  store.docs.clear()
  store.updates.length = 0
  store.denied.clear()
})

describe('indexDocument', () => {
  const memory = { path: ['memories', 'm1'], decrypt: (key, data) => import('../services/memories').then((m) => m.decryptMemoryDoc(key, data)) }

  it('works the map out from the decrypted document and writes it whole', async () => {
    store.docs.set('memories/m1', {
      familyId: 'fam-1',
      images: [LEGACY_URL],
      contentRich: sealed({ type: 'doc', content: [{ type: 'encryptedImage', attrs: { publicId: NEW_ID } }] }),
      // A partial map left by a later edit.
      mediaRefs: { title: [] },
    })
    expect(await indexDocument(memory, 'key')).toBe('updated')
    expect(store.updates).toEqual([['memories/m1', {
      mediaRefs: { images: ['legacy:raw/kaydo/encrypted/old1.dat'], contentRich: [NEW_ID] },
    }]])
  })

  it('leaves a document whose map is already right alone', async () => {
    store.docs.set('memories/m1', { familyId: 'fam-1', images: [LEGACY_URL], mediaRefs: { images: ['legacy:raw/kaydo/encrypted/old1.dat'] } })
    expect(await indexDocument(memory, 'key')).toBe('unchanged')
    expect(store.updates).toEqual([])
  })

  it('skips what the rules refuse, such as a sealed letter', async () => {
    store.denied.add('blackboxContent/b1')
    expect(await indexDocument({ path: ['blackboxContent', 'b1'], decrypt: (_k, d) => d }, 'key')).toBe('skipped')
  })
})

describe('indexFamilyMedia', () => {
  it('visits the family’s documents, its capsules’ letters and the family document, then notes the date', async () => {
    store.docs.set('moments/n1', { familyId: 'fam-1', images: [LEGACY_URL] })
    store.docs.set('moments/other', { familyId: 'fam-2', images: [LEGACY_URL] })
    store.docs.set('blackbox/b1', { familyId: 'fam-1', title: 'enc' })
    store.docs.set('families/fam-1', { familyName: 'Millers', loginHeaderImage: 'https://res.cloudinary.com/demo/image/upload/kaydo/head.jpg' })
    store.denied.add('blackboxContent/b1')

    const scanned = await scanMediaDocuments('fam-1', 'uid-1')
    expect(scanned.map((d) => d.path.join('/')).sort()).toEqual(['blackbox/b1', 'blackboxContent/b1', 'families/fam-1', 'moments/n1'])

    const progress = vi.fn()
    const stats = await indexFamilyMedia('fam-1', 'uid-1', 'key', { onProgress: progress })
    expect(stats).toMatchObject({ done: 4, total: 4, updated: 2, skipped: 1, failed: 0, stopped: false })
    expect(progress).toHaveBeenLastCalledWith(4, 4)
    expect(store.updates).toContainEqual(['families/fam-1', { mediaRefs: { loginHeaderImage: ['legacy:image/kaydo/head'] } }])
    expect(store.updates).toContainEqual(['families/fam-1', { mediaIndexedAt: 'SERVER_TIME' }])
  })

  it('notes no date for a run that was stopped', async () => {
    store.docs.set('moments/n1', { familyId: 'fam-1', images: [LEGACY_URL] })
    const stats = await indexFamilyMedia('fam-1', 'uid-1', 'key', { shouldStop: () => true })
    expect(stats.stopped).toBe(true)
    expect(store.updates).toEqual([])
  })
})

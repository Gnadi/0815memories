/* The service layer (src/services/), run against the demo's in-memory
   Firestore with real encryption.

   Two things it is there for. A page that loads one document and the list it
   came from decrypt it the same way — the pages used to carry their own copy of
   each area's decryption. And a list shows its newest snapshot only: every
   list but the moments row could let a slower decrypt of an older snapshot
   overwrite a newer one. */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { webcrypto } from 'node:crypto'

vi.mock('../config/firebase', () => ({ db: {}, auth: null }))

import { installDemoDatabase } from '../config/firestore'
import { createDemoDatabase } from '../demo/demoDatabase'
import { generateEncryptionKey, clearDecryptedTextCache } from '../utils/encryption'
import { getFamilyDocument, subscribeDecrypted } from '../services/decrypted'
import { addRecipe, getRecipe, subscribeRecipes } from '../services/recipes'
import { addScrapbook, getScrapbook, subscribeScrapbooks } from '../services/scrapbooks'
import { addMemory, getMemory } from '../services/memories'

// jsdom has no working crypto.subtle — graft Node's on, as encryption.test.js does.
beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
  }
})

const FAMILY = 'family-1'
const OTHER = 'family-2'

let fs
let key

// Lets the database's listeners and the decrypts they start run to the end.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

function firstDelivery(subscribe) {
  return new Promise((resolve, reject) => {
    const stop = subscribe((value) => {
      stop()
      resolve(value)
    }, reject)
  })
}

beforeEach(async () => {
  clearDecryptedTextCache()
  if (!key) ({ key } = await generateEncryptionKey())
  fs = createDemoDatabase({
    documents: [
      ['notes/a', { familyId: FAMILY, text: 'first' }],
      ['notes/theirs', { familyId: OTHER, text: 'not ours' }],
    ],
    uid: 'uid-admin',
  })
  installDemoDatabase(fs)
})

afterEach(() => {
  installDemoDatabase(null)
})

describe('subscribeDecrypted', () => {
  const notes = () => fs.query(fs.collection(null, 'notes'), fs.where('familyId', '==', FAMILY))

  it('hands over each snapshot, decrypted', async () => {
    const texts = await firstDelivery((onData, onError) =>
      subscribeDecrypted(notes(), async (docs) => docs.map((d) => d.text.toUpperCase()), onData, onError))
    expect(texts).toEqual(['FIRST'])
  })

  it('delivers the newest snapshot only, when an older one decrypts slower', async () => {
    const finish = []
    const decrypt = (docs) => new Promise((resolve) => finish.push(() => resolve(docs.map((d) => d.id))))
    const seen = []
    const stop = subscribeDecrypted(notes(), decrypt, (ids) => seen.push(ids))

    await settle()
    await fs.setDoc(fs.doc(null, 'notes', 'b'), { familyId: FAMILY, text: 'second' })
    await settle()
    expect(finish).toHaveLength(2)

    finish[1]()
    await settle()
    finish[0]()
    await settle()

    expect(seen).toEqual([['a', 'b']])
    stop()
  })

  it('delivers nothing once unsubscribed', async () => {
    const finish = []
    const onData = vi.fn()
    const stop = subscribeDecrypted(notes(), (docs) => new Promise((resolve) => finish.push(() => resolve(docs))), onData)
    await settle()
    stop()
    finish[0]()
    await settle()
    expect(onData).not.toHaveBeenCalled()
  })

  it('reports a decrypt that fails', async () => {
    const error = await new Promise((resolve) => {
      subscribeDecrypted(notes(), async () => { throw new Error('bad ciphertext') }, () => {}, resolve)
    })
    expect(error.message).toBe('bad ciphertext')
  })
})

describe('getFamilyDocument', () => {
  const asIs = async (data) => data

  it('returns the family\'s own document', async () => {
    await expect(getFamilyDocument('notes', 'a', FAMILY, asIs)).resolves.toEqual({ id: 'a', familyId: FAMILY, text: 'first' })
  })

  it('returns null for a document that is gone, or another family\'s', async () => {
    await expect(getFamilyDocument('notes', 'missing', FAMILY, asIs)).resolves.toBeNull()
    await expect(getFamilyDocument('notes', 'theirs', FAMILY, asIs)).resolves.toBeNull()
  })
})

describe('one decryption for the list and the page', () => {
  it('recipes: every encrypted field, ingredients included', async () => {
    const recipe = {
      title: 'Grandma\'s strudel',
      description: 'Sunday afternoons',
      instructions: 'Stretch the dough thin.',
      chefNote: 'Use cold butter',
      forkReason: '',
      author: 'Grandma',
      ingredients: [{ name: 'Apples', amount: '1 kg' }],
      year: 1962,
    }
    const { id } = await addRecipe(FAMILY, key, recipe)

    const stored = (await fs.getDoc(fs.doc(null, 'recipes', id))).data()
    expect(stored.title).not.toBe(recipe.title)
    expect(typeof stored.ingredients).toBe('string')

    const loaded = await getRecipe(FAMILY, key, id)
    expect(loaded).toMatchObject(recipe)

    const [listed] = await firstDelivery((onData, onError) => subscribeRecipes(FAMILY, key, onData, onError))
    expect(listed).toMatchObject({ ...recipe, id, forkCount: 0 })
  })

  it('scrapbooks: the list leaves the pages encrypted, the editor gets them', async () => {
    const pages = [{ id: 'p1', elements: [] }, { id: 'p2', elements: [] }]
    const id = await addScrapbook(FAMILY, key, { title: 'Summer 2025', pages })

    const [listed] = await firstDelivery((onData, onError) =>
      subscribeScrapbooks(FAMILY, key, {}, onData, onError))
    expect(listed).toMatchObject({ id, title: 'Summer 2025', pageCount: 2 })
    expect(typeof listed.pages).toBe('string')

    await expect(getScrapbook(FAMILY, key, id)).resolves.toMatchObject({ title: 'Summer 2025', pages, pageCount: 2 })
  })

  it('memories: the page gets the rich description back as a document', async () => {
    const rich = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'At the lake' }] }] }
    await addMemory(FAMILY, key, { title: 'Lake day', content: 'At the lake', contentRich: JSON.stringify(rich) })
    const [{ id }] = (await fs.getDocs(fs.collection(null, 'memories'))).docs

    await expect(getMemory(FAMILY, key, id)).resolves.toMatchObject({ id, title: 'Lake day', contentRich: rich })
    await expect(getMemory(OTHER, key, id)).resolves.toBeNull()
  })
})

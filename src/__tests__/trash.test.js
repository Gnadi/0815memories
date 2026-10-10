/* The trash (src/services/trash.js), run against the demo's in-memory Firestore
   with real encryption.

   What it has to get right: a document goes in exactly as it was stored and
   comes back the same, with whatever belongs to it; and of its Cloudinary
   files, it marks for deletion only those nothing else still shows. A collage
   shows its memories' photos, and says so only in an encrypted field. */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { webcrypto } from 'node:crypto'

vi.mock('../config/firebase', () => ({ db: {}, auth: { currentUser: { uid: 'uid-admin' } } }))

import { installDemoDatabase } from '../config/firestore'
import { createDemoDatabase } from '../demo/demoDatabase'
import { generateEncryptionKey, clearDecryptedTextCache } from '../utils/encryption'
import { addMemory } from '../services/memories'
import { addCollage } from '../services/collages'
import { addKid } from '../services/kids'
import { addJournal } from '../services/journals'
import { addRecipe } from '../services/recipes'
import { addBox } from '../services/blackbox'
import {
  TRASH_DAYS, deleteForever, moveToTrash, restoreFromTrash, subscribeTrash,
} from '../services/trash'

beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
  }
})

const FAMILY = 'family-1'
const file = (name) => `https://res.cloudinary.com/kaydo/raw/upload/v1/kaydo/f/${FAMILY}/encrypted/${name}.dat`

let fs
let key

const read = async (path) => {
  const [coll, id] = path.split('/')
  const snap = await fs.getDoc(fs.doc(null, coll, id))
  return snap.exists() ? snap.data() : null
}
const all = async (coll) => (await fs.getDocs(fs.collection(null, coll))).docs.map((d) => ({ id: d.id, ...d.data() }))

// addMemory returns nothing, so the new id is the one that was not there before.
async function newMemory(memory) {
  const before = new Set((await all('memories')).map((m) => m.id))
  await addMemory(FAMILY, key, memory)
  return (await all('memories')).find((m) => !before.has(m.id)).id
}

function trashNow() {
  return new Promise((resolve, reject) => {
    const stop = subscribeTrash(FAMILY, key, (groups) => {
      stop()
      resolve(groups)
    }, reject)
  })
}

beforeEach(async () => {
  clearDecryptedTextCache()
  if (!key) ({ key } = await generateEncryptionKey())
  fs = createDemoDatabase({ documents: [], uid: 'uid-admin' })
  installDemoDatabase(fs)
})

afterEach(() => {
  installDemoDatabase(null)
})

describe('moveToTrash', () => {
  it('moves the document exactly as it was stored, with its files', async () => {
    const id = await newMemory({ title: 'Zell am See', images: [file('lake')], thumbs: [file('lake-thumb')] })
    const stored = await read(`memories/${id}`)

    await moveToTrash(key, 'memories', id)

    expect(await read(`memories/${id}`)).toBeNull()
    const entry = await read(`trash/memories__${id}`)
    expect(entry).toMatchObject({
      familyId: FAMILY, collection: 'memories', docId: id, group: `memories__${id}`, deletedBy: 'uid-admin',
    })
    // Byte for byte: the title is still the ciphertext it was.
    expect(entry.data).toEqual(stored)
    expect(entry.media.sort()).toEqual([file('lake'), file('lake-thumb')].sort())
  })

  it("keeps a photo a collage still shows, though only the collage's encrypted field says so", async () => {
    const id = await newMemory({ title: 'Summer', images: [file('shared'), file('own')] })
    await addCollage(FAMILY, key, { title: 'Best of', doc: { slots: [{ url: file('shared') }] } })

    await moveToTrash(key, 'memories', id)

    expect((await read(`trash/memories__${id}`)).media).toEqual([file('own')])
  })

  it("keeps a collage's photos that a memory still shows, and takes its own", async () => {
    await newMemory({ title: 'Summer', images: [file('memory-photo')] })
    const collageId = await addCollage(FAMILY, key, {
      title: 'Best of', doc: { slots: [{ url: file('memory-photo') }, { url: file('uploaded-in-editor') }] },
    })

    await moveToTrash(key, 'collages', collageId)

    expect((await read(`trash/collages__${collageId}`)).media).toEqual([file('uploaded-in-editor')])
  })

  it('counts what is already in the trash as still showing a photo', async () => {
    const memoryId = await newMemory({ title: 'Summer', images: [file('shared')] })
    const collageId = await addCollage(FAMILY, key, { title: 'Best of', doc: { slots: [{ url: file('shared') }] } })

    await moveToTrash(key, 'collages', collageId)
    await moveToTrash(key, 'memories', memoryId)

    // Restoring the collage within the month must still find its photo.
    expect((await read(`trash/memories__${memoryId}`)).media).toEqual([])
  })

  it('keeps every file when it cannot tell which are shared, and deletes anyway', async () => {
    const id = await newMemory({ title: 'Summer', images: [file('own')] })
    const getDocs = fs.getDocs
    fs.getDocs = async (source) => {
      // The two-field queries are the ones that need the new indexes.
      const wheres = source?._constraints?.filter((c) => c.kind === 'where') ?? []
      if (wheres.length > 1) throw Object.assign(new Error('The query requires an index'), { code: 'failed-precondition' })
      return getDocs(source)
    }
    try {
      await moveToTrash(key, 'memories', id)
    } finally {
      fs.getDocs = getDocs
    }
    expect(await read(`memories/${id}`)).toBeNull()
    expect((await read(`trash/memories__${id}`)).media).toEqual([])
  })

  it('takes a child with their journal, as one group', async () => {
    await addKid(FAMILY, key, { name: 'Lena', profilePhoto: file('lena') })
    const kidId = (await all('children'))[0].id
    await addJournal(FAMILY, kidId, key, { content: 'First steps', photos: [file('steps')] })
    await addJournal(FAMILY, kidId, key, { content: 'First word' })

    await moveToTrash(key, 'children', kidId)

    expect(await all('children')).toEqual([])
    expect(await all('journals')).toEqual([])
    const entries = await all('trash')
    expect(entries).toHaveLength(3)
    expect(new Set(entries.map((e) => e.group))).toEqual(new Set([`children__${kidId}`]))
    expect(entries.flatMap((e) => e.media).sort()).toEqual([file('lena'), file('steps')].sort())
  })

  it('takes a recipe with the versions grown from it', async () => {
    const root = await addRecipe(FAMILY, key, { title: 'Kaiserschmarrn' })
    await addRecipe(FAMILY, key, { title: 'Kaiserschmarrn, vegan', rootId: root.id })

    await moveToTrash(key, 'recipes', root.id)

    expect(await all('recipes')).toEqual([])
    expect((await all('trash')).map((e) => e.group)).toEqual([`recipes__${root.id}`, `recipes__${root.id}`])
  })

  it('leaves a capsule\'s letter where it is, sealed, and moves only the capsule', async () => {
    await addBox(FAMILY, key, {
      title: 'For your 18th', message: 'Dear Lena', photos: [file('letter-photo')],
      triggerType: 'specificDate', unlockDate: new Date(Date.now() + 365 * 86400000),
    })
    const boxId = (await all('blackbox'))[0].id

    await moveToTrash(key, 'blackbox', boxId)

    expect(await all('blackbox')).toEqual([])
    expect((await all('trash')).map((e) => e.collection)).toEqual(['blackbox'])
    // Still there, and still not to be read: the demo keeps the rule's time
    // lock, under which a missing letter reads as absent rather than denied.
    await expect(fs.getDoc(fs.doc(null, 'blackboxContent', boxId))).rejects.toMatchObject({ code: 'permission-denied' })
  })
})

describe('the trash list, restoring and deleting for good', () => {
  it('shows each group once, decrypted, with the day it goes for good', async () => {
    await addKid(FAMILY, key, { name: 'Lena' })
    const kidId = (await all('children'))[0].id
    await addJournal(FAMILY, kidId, key, { content: 'First steps' })
    const memoryId = await newMemory({ title: 'Zell am See' })

    await moveToTrash(key, 'children', kidId)
    await moveToTrash(key, 'memories', memoryId)
    const groups = await trashNow()

    // Both were deleted within the same millisecond here, so in either order.
    expect(groups.map((g) => [g.collection, g.title, g.more]).sort()).toEqual([
      ['children', 'Lena', 1],
      ['memories', 'Zell am See', 0],
    ])
    const memory = groups.find((g) => g.collection === 'memories')
    expect(memory.purgeAt - memory.deletedAt).toBe(TRASH_DAYS * 24 * 60 * 60 * 1000)
  })

  it('restores every document of a group, as it was', async () => {
    await addKid(FAMILY, key, { name: 'Lena' })
    const kidId = (await all('children'))[0].id
    await addJournal(FAMILY, kidId, key, { content: 'First steps' })
    const before = { kids: await all('children'), journals: await all('journals') }

    await moveToTrash(key, 'children', kidId)
    const [group] = await trashNow()
    await restoreFromTrash(group)

    expect(await all('children')).toEqual(before.kids)
    expect(await all('journals')).toEqual(before.journals)
    expect(await all('trash')).toEqual([])
  })

  it('hands a group deleted for good to the server, and stops showing it', async () => {
    await addKid(FAMILY, key, { name: 'Lena' })
    const kidId = (await all('children'))[0].id
    await addJournal(FAMILY, kidId, key, { content: 'First steps' })
    await moveToTrash(key, 'children', kidId)

    const [group] = await trashNow()
    await deleteForever(group)

    expect((await all('trash')).map((e) => e.purgeNow)).toEqual([true, true])
    expect(await trashNow()).toEqual([])
  })
})

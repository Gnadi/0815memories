// @vitest-environment node
/**
 * `mediaRefs` against the emulator: what the services write is accepted by the
 * rules, behaves in Firestore the way src/services/mediaRefs.js counts on
 * (field paths replace one field's entry, deletions of entries that were never
 * there change nothing), and moves the ledger as functions/mediaRefs.js says.
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment, assertSucceeds } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, setDoc, updateDoc } from 'firebase/firestore'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { mediaRefsForCreate, mediaRefsForMerge, mediaRefsForUpdate } from '../services/mediaRefs'
import { MEDIA_ASSETS } from '../../functions/mediaSigning.js'
import { trackMediaRefs } from '../../functions/mediaRefs.js'

// Set by `firebase emulators:exec`; absent during a plain `npm test`.
const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST
const FAMILY = 'fam-a'
const ADMIN = 'uid-admin'

const hex = (c) => c.repeat(32)
const pid = (c) => `kaydo/${FAMILY}/${hex(c)}`
const url = (c) => `https://res.cloudinary.com/demo/raw/upload/v1/${pid(c)}`

let testEnv
let adminApp
let db

describe.skipIf(!EMULATOR)('media references', () => {
  beforeAll(async () => {
    const [host, port] = EMULATOR.split(':')
    testEnv = await initializeTestEnvironment({
      // Its own project: clearFirestore() wipes the whole project, and vitest
      // runs the rules suites in parallel.
      projectId: 'demo-kaydo-media-refs-rules',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
    })
    // The Admin SDK finds the emulator through FIRESTORE_EMULATOR_HOST.
    adminApp = initializeApp({ projectId: 'demo-kaydo-media-refs-rules' }, 'media-refs-rules')
    db = getFirestore(adminApp)
  })

  afterAll(async () => {
    await testEnv?.cleanup()
    if (adminApp) await deleteApp(adminApp)
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
    await db.doc(`families/${FAMILY}`).set({ adminUid: ADMIN, adminUids: [ADMIN], familyName: 'Millers' })
    for (const c of ['a', 'b', 'c']) {
      await db.collection(MEDIA_ASSETS).doc(hex(c)).set({ familyId: FAMILY, publicId: pid(c), state: 'pending', refs: [] })
    }
  })

  const asAdmin = () =>
    testEnv.authenticatedContext(ADMIN, { familyId: FAMILY, role: 'admin', email_verified: true }).firestore()

  const read = async (path) => (await db.doc(path).get()).data() ?? null
  const stateOf = async (c) => (await read(`${MEDIA_ASSETS}/${hex(c)}`)).state

  /** Write as the admin, then run the trigger on what Firestore made of it. */
  async function write(collection, docId, change) {
    const path = `${collection}/${docId}`
    const before = await read(path)
    await assertSucceeds(change(doc(asAdmin(), collection, docId)))
    const after = await read(path)
    await trackMediaRefs({ db }, { collection, docId, before, after })
    return after
  }

  it('follows a memory through creation, partial edits and deletion', async () => {
    const created = { familyId: FAMILY, title: 'Summer', images: [url('a'), url('b')] }
    await write('memories', 'm1', (ref) => setDoc(ref, { ...created, ...mediaRefsForCreate(created) }))
    expect(await stateOf('a')).toBe('attached')
    expect(await stateOf('b')).toBe('attached')

    // A title edit leaves the photos' entry alone.
    const after = await write('memories', 'm1', (ref) => updateDoc(ref, { title: 'Summer 26', ...mediaRefsForUpdate({ title: 'Summer 26' }) }))
    expect(after.mediaRefs).toEqual({ images: [pid('a'), pid('b')] })

    // Taking a photo out lets go of it; adding one attaches it.
    const images = [url('b'), url('c')]
    await write('memories', 'm1', (ref) => updateDoc(ref, { images, ...mediaRefsForUpdate({ images }) }))
    expect(await stateOf('a')).toBe('detached')
    expect(await stateOf('b')).toBe('attached')
    expect(await stateOf('c')).toBe('attached')

    await write('memories', 'm1', (ref) => deleteDoc(ref))
    expect(await stateOf('b')).toBe('detached')
    expect(await stateOf('c')).toBe('detached')
  })

  it('leaves a document from before mediaRefs as it was on an edit without media', async () => {
    await db.doc('memories/old').set({ familyId: FAMILY, title: 'Old', images: ['https://res.cloudinary.com/demo/raw/upload/v1/kaydo/encrypted/legacy'] })
    const after = await write('memories', 'old', (ref) => updateDoc(ref, { title: 'Older', ...mediaRefsForUpdate({ title: 'Older' }) }))
    expect(after.mediaRefs ?? {}).toEqual({})
  })

  it('takes the login page’s pictures on the family document, merged', async () => {
    const fields = { loginHeaderImage: `https://res.cloudinary.com/demo/image/upload/v1/kaydo/public/${FAMILY}/${hex('a')}.jpg` }
    await db.doc(`${MEDIA_ASSETS}/${hex('a')}`).set({ familyId: FAMILY, publicId: `kaydo/public/${FAMILY}/${hex('a')}`, state: 'pending', refs: [] })
    const after = await write('families', FAMILY, (ref) => setDoc(ref, { ...fields, ...mediaRefsForMerge(fields) }, { merge: true }))
    expect(after.familyName).toBe('Millers')
    expect(await stateOf('a')).toBe('attached')

    await write('families', FAMILY, (ref) => setDoc(ref, { loginHeaderImage: '', ...mediaRefsForMerge({ loginHeaderImage: '' }) }, { merge: true }))
    expect(await stateOf('a')).toBe('detached')
  })
})

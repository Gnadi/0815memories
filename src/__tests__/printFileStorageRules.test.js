// @vitest-environment node
/**
 * Security-rule tests for Firebase Storage — storage.rules.
 *
 * The bucket holds the print files of scrapbooks ordered from Peecho: the only
 * unencrypted copies of a family's photos the app ever stores. So only the
 * family's admins may write or look at them, a file can never be swapped out
 * once its URL has gone to Peecho, and nothing else may be stored at all.
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, setDoc } from 'firebase/firestore'
import { readFileSync } from 'node:fs'

const env = globalThis.process?.env ?? {}
const STORAGE_EMULATOR = env.FIREBASE_STORAGE_EMULATOR_HOST
const FIRESTORE_EMULATOR = env.FIRESTORE_EMULATOR_HOST

const FAMILY = 'family-1'
const OTHER_FAMILY = 'family-2'
const ADMIN = 'uid-admin'
// In adminUids, but the syncAdminClaims trigger has not given them a claim yet.
const NEW_ADMIN = 'uid-new-admin'
const OTHER_ADMIN = 'uid-other-admin'

const PDF = { contentType: 'application/pdf' }
const JPEG = { contentType: 'image/jpeg' }
const bytes = (n = 16) => new Uint8Array(n)

let testEnv
// A folder of its own for every test: clearStorage() only deletes objects at
// the top of the bucket, and print files are nested three folders deep.
let printId = 0

const hostPort = (value) => {
  const [host, port] = value.split(':')
  return { host, port: Number(port) }
}

describe.skipIf(!STORAGE_EMULATOR || !FIRESTORE_EMULATOR)('Storage security rules (print files)', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      // The project the emulators were started for: the storage rules' own
      // firestore.get() reads the family document from that project.
      projectId: 'demo-kaydo',
      storage: { rules: readFileSync('storage.rules', 'utf8'), ...hostPort(STORAGE_EMULATOR) },
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), ...hostPort(FIRESTORE_EMULATOR) },
    })
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'families', FAMILY), { adminUids: [ADMIN, NEW_ADMIN] })
      await setDoc(doc(context.firestore(), 'families', OTHER_FAMILY), { adminUids: [OTHER_ADMIN] })
    })
  })

  afterAll(async () => {
    await testEnv?.cleanup()
  })

  beforeEach(() => {
    printId += 1
  })

  const admin = () => testEnv.authenticatedContext(ADMIN, { familyId: FAMILY, role: 'admin' }).storage()
  const newAdmin = () => testEnv.authenticatedContext(NEW_ADMIN).storage()
  const otherAdmin = () => testEnv.authenticatedContext(OTHER_ADMIN, { familyId: OTHER_FAMILY, role: 'admin' }).storage()
  const viewer = () => testEnv.authenticatedContext(`viewer:${FAMILY}`, { familyId: FAMILY, role: 'viewer' }).storage()
  const anonymous = () => testEnv.unauthenticatedContext().storage()

  const path = (name, family = FAMILY) => `printFiles/${family}/print-${printId}/${name}`

  async function seed(name = 'book.pdf', metadata = PDF) {
    await testEnv.withSecurityRulesDisabled((context) => context.storage().ref(path(name)).put(bytes(), metadata))
  }

  it('lets an admin store a book and its cover picture', async () => {
    await assertSucceeds(admin().ref(path('book.pdf')).put(bytes(), PDF))
    await assertSucceeds(admin().ref(path('cover.jpg')).put(bytes(), JPEG))
  })

  it('lets an admin whose claim has not landed yet store one too', async () => {
    await assertSucceeds(newAdmin().ref(path('book.pdf')).put(bytes(), PDF))
  })

  it('keeps everyone else from storing one', async () => {
    await assertFails(viewer().ref(path('book.pdf')).put(bytes(), PDF))
    await assertFails(anonymous().ref(path('book.pdf')).put(bytes(), PDF))
    await assertFails(otherAdmin().ref(path('book.pdf')).put(bytes(), PDF))
  })

  it('stores only a PDF book and a JPEG cover, under their own names', async () => {
    await assertFails(admin().ref(path('book.pdf')).put(bytes(), { contentType: 'text/html' }))
    await assertFails(admin().ref(path('cover.jpg')).put(bytes(), PDF))
    await assertFails(admin().ref(path('index.html')).put(bytes(), { contentType: 'text/html' }))
    await assertFails(admin().ref(path('book.pdf.jpg')).put(bytes(), JPEG))
  })

  it('caps the cover picture’s size', async () => {
    await assertFails(admin().ref(path('cover.jpg')).put(bytes(5 * 1024 * 1024 + 1), JPEG))
  })

  // The download URL already handed to Peecho must keep meaning this file.
  it('never lets a stored file be replaced', async () => {
    await seed()
    await assertFails(admin().ref(path('book.pdf')).put(bytes(32), PDF))
  })

  it('shows a stored file to the family’s admins only', async () => {
    await seed()
    await assertSucceeds(admin().ref(path('book.pdf')).getMetadata())
    await assertSucceeds(newAdmin().ref(path('book.pdf')).getMetadata())
    await assertFails(viewer().ref(path('book.pdf')).getMetadata())
    await assertFails(anonymous().ref(path('book.pdf')).getMetadata())
    await assertFails(otherAdmin().ref(path('book.pdf')).getMetadata())
  })

  it('lets the family’s admins delete a stored file, and nobody else', async () => {
    await seed()
    await assertFails(viewer().ref(path('book.pdf')).delete())
    await assertFails(otherAdmin().ref(path('book.pdf')).delete())
    await assertSucceeds(admin().ref(path('book.pdf')).delete())
  })

  it('closes the rest of the bucket', async () => {
    await assertFails(admin().ref(`uploads/${FAMILY}/photo.jpg`).put(bytes(), JPEG))
    await assertFails(admin().ref(`printFiles/${FAMILY}/book.pdf`).put(bytes(), PDF))
    await assertFails(admin().ref(`printFiles/${FAMILY}/print-${printId}/nested/book.pdf`).put(bytes(), PDF))
  })
})

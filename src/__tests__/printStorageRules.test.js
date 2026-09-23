// @vitest-environment node
/**
 * Security-rule tests for the print-file bucket.
 *
 * This is the one place in Kaydo where plaintext family content comes to rest:
 * a press cannot print ciphertext, so the print PDF is uploaded as-is. That
 * makes storage.rules the whole of the access control, and "I wrote the rules
 * carefully" is not evidence that they hold. These tests are.
 *
 * What they pin down: only an admin of the owning family may write or read a
 * print file, a neighbouring family's admin cannot, a viewer with the shared
 * password cannot, a signed-out visitor cannot, the object must actually be a
 * PDF, and nothing outside printFiles/ is writable at all.
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, beforeAll, afterAll } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { ref, uploadBytes, getBytes, deleteObject, listAll } from 'firebase/storage'
import { readFileSync } from 'node:fs'

// The Storage emulator announces itself with a scheme ("http://127.0.0.1:9199"),
// unlike the Firestore one, and under either of two names depending on the
// firebase-tools version. initializeTestEnvironment wants a bare host and port.
const RAW_EMULATOR = globalThis.process?.env?.STORAGE_EMULATOR_HOST
  || globalThis.process?.env?.FIREBASE_STORAGE_EMULATOR_HOST
const EMULATOR = RAW_EMULATOR?.replace(/^https?:\/\//, '')

const FAMILY = 'family-1'
const OTHER_FAMILY = 'family-2'
const SCRAPBOOK = 'book-1'

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x33]) // %PDF-1.3
const PDF_META = { contentType: 'application/pdf' }

// Every upload in the app gets a fresh random name, and the rules are
// create-only, so each test works on its own file rather than sharing one.
let counter = 0
const freshName = () => `file-${++counter}.pdf`
const path = (family = FAMILY, book = SCRAPBOOK, name = freshName()) =>
  `printFiles/${family}/${book}/${name}`

let testEnv

/** A context carrying the claims the app's sign-in actually mints. */
const admin = (family) => testEnv.authenticatedContext(`uid-${family}-admin`, { familyId: family, role: 'admin' })
const viewer = (family) => testEnv.authenticatedContext(`uid-${family}-viewer`, { familyId: family, role: 'viewer' })

describe.skipIf(!EMULATOR)('Print file storage rules', () => {
  beforeAll(async () => {
    const [host, port] = EMULATOR.split(':')
    testEnv = await initializeTestEnvironment({
      // Must match the project the Storage emulator was started with: unlike
      // Firestore, it serves exactly one bucket and a request for another
      // project's bucket never answers.
      projectId: 'demo-kaydo',
      storage: { rules: readFileSync('storage.rules', 'utf8'), host, port: Number(port) },
    })
  })

  afterAll(async () => {
    await testEnv?.cleanup()
  })


  it('lets a family admin upload their own print file', async () => {
    const storage = admin(FAMILY).storage()
    await assertSucceeds(uploadBytes(ref(storage, path()), PDF, PDF_META))
  })

  it('lets that admin read it back', async () => {
    const storage = admin(FAMILY).storage()
    const target = path()
    await assertSucceeds(uploadBytes(ref(storage, target), PDF, PDF_META))
    await assertSucceeds(getBytes(ref(storage, target)))
  })

  it('lets that admin delete it, so cleanup after fulfilment is possible', async () => {
    const storage = admin(FAMILY).storage()
    const target = path()
    await assertSucceeds(uploadBytes(ref(storage, target), PDF, PDF_META))
    await assertSucceeds(deleteObject(ref(storage, target)))
  })

  it('refuses another family’s admin, even knowing the exact path', async () => {
    const target = path()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), target), PDF, PDF_META)
    })
    const intruder = admin(OTHER_FAMILY).storage()
    await assertFails(getBytes(ref(intruder, target)))
    await assertFails(deleteObject(ref(intruder, target)))
    await assertFails(uploadBytes(ref(intruder, path(FAMILY, SCRAPBOOK, 'evil.pdf')), PDF, PDF_META))
  })

  it('refuses a viewer of the same family — ordering a book is not a viewer’s to do', async () => {
    const storage = viewer(FAMILY).storage()
    await assertFails(uploadBytes(ref(storage, path()), PDF, PDF_META))
    await assertFails(getBytes(ref(storage, path())))
  })

  it('refuses a signed-out visitor', async () => {
    const storage = testEnv.unauthenticatedContext().storage()
    await assertFails(uploadBytes(ref(storage, path()), PDF, PDF_META))
    await assertFails(getBytes(ref(storage, path())))
  })

  it('refuses an authenticated user carrying no family claim at all', async () => {
    const storage = testEnv.authenticatedContext('uid-stranger').storage()
    await assertFails(uploadBytes(ref(storage, path()), PDF, PDF_META))
    await assertFails(getBytes(ref(storage, path())))
  })

  it('refuses anything that is not a PDF', async () => {
    const storage = admin(FAMILY).storage()
    await assertFails(uploadBytes(ref(storage, path()), PDF, { contentType: 'text/html' }))
    await assertFails(uploadBytes(ref(storage, path()), PDF, { contentType: 'image/svg+xml' }))
  })

  it('refuses overwriting an existing print file in place', async () => {
    const storage = admin(FAMILY).storage()
    const target = path()
    await assertSucceeds(uploadBytes(ref(storage, target), PDF, PDF_META))
    // A replacement has to arrive under a new random name, so content can never
    // be swapped under a URL a printer has already been handed.
    await assertFails(uploadBytes(ref(storage, target), PDF, PDF_META))
  })

  it('refuses listing a family’s print folder', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), path()), PDF, PDF_META)
    })
    // Enumeration would defeat the unguessable filename, which is what keeps a
    // download URL from being brute-forced.
    await assertFails(listAll(ref(admin(FAMILY).storage(), `printFiles/${FAMILY}/${SCRAPBOOK}`)))
  })

  it('refuses every path outside printFiles/', async () => {
    const storage = admin(FAMILY).storage()
    await assertFails(uploadBytes(ref(storage, `somethingElse/${FAMILY}/x.pdf`), PDF, PDF_META))
    await assertFails(uploadBytes(ref(storage, 'x.pdf'), PDF, PDF_META))
    await assertFails(getBytes(ref(storage, `somethingElse/${FAMILY}/x.pdf`)))
  })
})

// @vitest-environment node
/**
 * Journal entries against the emulator: their text is stored rich, encrypted,
 * or as Markdown, a readable rich document is refused, and an entry from before
 * either editor stays editable.
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { deleteField, doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { readFileSync } from 'node:fs'

// Set by `firebase emulators:exec`; absent during a plain `npm test`.
const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

const FAMILY = 'family-1'
const ADMIN = 'uid-admin'

let testEnv

const entry = (extra = {}) => ({
  familyId: FAMILY,
  childId: 'kid-1',
  title: 'First tooth',
  content: 'ciphertext',
  date: Timestamp.now(),
  ...extra,
})

const RICH_DOC = { type: 'doc', content: [] }

describe.skipIf(!EMULATOR)('journals', () => {
  beforeAll(async () => {
    const [host, port] = EMULATOR.split(':')
    testEnv = await initializeTestEnvironment({
      // Its own project: clearFirestore() wipes the whole project, and vitest
      // runs the rules suites in parallel.
      projectId: 'demo-kaydo-journal-rules',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
    })
  })

  afterAll(async () => {
    await testEnv?.cleanup()
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'families', FAMILY), { adminUid: ADMIN, adminUids: [ADMIN] })
      // An entry as every client wrote them before the editor: no format at all.
      await setDoc(doc(db, 'journals', 'legacy'), entry())
    })
  })

  const asAdmin = () => testEnv.authenticatedContext(ADMIN, { familyId: FAMILY, role: 'admin' }).firestore()
  const asViewer = () =>
    testEnv.authenticatedContext(`viewer:${FAMILY}`, { familyId: FAMILY, role: 'viewer' }).firestore()

  it('are stored rich, encrypted, or as Markdown', async () => {
    await assertSucceeds(setDoc(doc(asAdmin(), 'journals', 'rich'),
      entry({ contentFormat: 'rich', contentRich: 'Y2lwaGVydGV4dA==' })))
    await assertSucceeds(setDoc(doc(asAdmin(), 'journals', 'md'), entry({ contentFormat: 'markdown' })))
  })

  it('are refused with a readable rich document', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'journals', 'map'), entry({ contentRich: RICH_DOC })))
    await assertFails(setDoc(doc(asAdmin(), 'journals', 'json'), entry({ contentRich: JSON.stringify(RICH_DOC) })))
    await assertFails(updateDoc(doc(asAdmin(), 'journals', 'legacy'), { contentRich: JSON.stringify(RICH_DOC) }))
  })

  it('are refused in a format nobody reads', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'journals', 'html'), entry({ contentFormat: 'html' })))
  })

  it('from before the editor stay editable, and switch between the formats', async () => {
    await assertSucceeds(updateDoc(doc(asAdmin(), 'journals', 'legacy'), { content: 'ciphertext 2' }))
    await assertSucceeds(updateDoc(doc(asAdmin(), 'journals', 'legacy'), {
      contentFormat: 'rich', contentRich: 'Y2lwaGVydGV4dA==',
    }))
    await assertSucceeds(updateDoc(doc(asAdmin(), 'journals', 'legacy'), {
      contentFormat: 'markdown', contentRich: deleteField(),
    }))
  })

  it('stay with the admins', async () => {
    await assertFails(getDoc(doc(asViewer(), 'journals', 'legacy')))
    await assertFails(setDoc(doc(asViewer(), 'journals', 'v'), entry({ contentFormat: 'markdown' })))
  })
})

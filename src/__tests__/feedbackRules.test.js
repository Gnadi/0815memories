/**
 * Security-rule tests for app feedback.
 *
 * This collection is the one place a viewer may write, and the one place
 * nobody may read — so both halves are worth holding down. It is also the only
 * unencrypted collection a signed-in client can append to, which is why the
 * shape checks below matter as much as the access ones.
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { FEEDBACK_MESSAGE_MAX } from '../constants/feedback'

const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

const FAMILY = 'family-1'
const OTHER_FAMILY = 'family-2'
const ADMIN = 'uid-admin'
const OTHER_ADMIN = 'uid-other-admin'
const VIEWER = 'uid-viewer'

let testEnv

const note = (overrides = {}) => ({
  familyId: FAMILY,
  uid: ADMIN,
  role: 'admin',
  message: 'The timeline takes a while to open.',
  category: 'bug',
  rating: 3,
  contact: '',
  path: '/timeline',
  language: 'en',
  userAgent: 'test-agent',
  status: 'new',
  createdAt: serverTimestamp(),
  ...overrides,
})

describe.skipIf(!EMULATOR)('Feedback security rules', () => {
  beforeAll(async () => {
    const [host, port] = EMULATOR.split(':')
    testEnv = await initializeTestEnvironment({
      // Its own project id: clearFirestore() wipes a whole project, and vitest
      // runs the rules suites in parallel.
      projectId: 'demo-kaydo-feedback-rules',
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
      await setDoc(doc(db, 'families', FAMILY), { adminUid: ADMIN, adminUids: [ADMIN], familyName: 'One' })
      await setDoc(doc(db, 'families', OTHER_FAMILY), { adminUid: OTHER_ADMIN, adminUids: [OTHER_ADMIN], familyName: 'Two' })
      await setDoc(doc(db, 'feedback', 'existing'), { ...note(), createdAt: new Date() })
    })
  })

  const asAdmin = () => testEnv.authenticatedContext(ADMIN, { role: 'admin', familyId: FAMILY }).firestore()
  const asViewer = () => testEnv.authenticatedContext(VIEWER, { role: 'viewer', familyId: FAMILY }).firestore()
  const asOtherAdmin = () => testEnv.authenticatedContext(OTHER_ADMIN, { role: 'admin', familyId: OTHER_FAMILY }).firestore()
  const asVisitor = () => testEnv.unauthenticatedContext().firestore()

  it('lets an admin send feedback about their own family', async () => {
    await assertSucceeds(setDoc(doc(asAdmin(), 'feedback', 'new-admin'), note()))
  })

  // The point of the collection: the people who use the app the most are
  // viewers, and this is the only thing they are allowed to write.
  it('lets a viewer send feedback too', async () => {
    await assertSucceeds(setDoc(doc(asViewer(), 'feedback', 'new-viewer'), note({ uid: VIEWER, role: 'viewer' })))
  })

  it('will not let a viewer sign their feedback as an admin', async () => {
    await assertFails(setDoc(doc(asViewer(), 'feedback', 'faked'), note({ uid: VIEWER, role: 'admin' })))
  })

  it('will not let anyone write feedback under someone else’s uid', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'feedback', 'spoofed'), note({ uid: VIEWER })))
  })

  it('rejects a signed-out visitor', async () => {
    await assertFails(setDoc(doc(asVisitor(), 'feedback', 'anon'), note()))
  })

  it('rejects feedback filed against a family the sender is not in', async () => {
    await assertFails(setDoc(doc(asOtherAdmin(), 'feedback', 'cross'), note()))
  })

  // No read, by anyone — feedback is addressed to whoever runs the app, and a
  // readable collection would hand every family's notes to every other family.
  it('is invisible to everyone, its own author included', async () => {
    await assertFails(getDoc(doc(asAdmin(), 'feedback', 'existing')))
    await assertFails(getDoc(doc(asViewer(), 'feedback', 'existing')))
    await assertFails(getDoc(doc(asVisitor(), 'feedback', 'existing')))
  })

  it('cannot be edited or withdrawn once sent', async () => {
    await assertFails(updateDoc(doc(asAdmin(), 'feedback', 'existing'), { message: 'never mind' }))
    await assertFails(deleteDoc(doc(asAdmin(), 'feedback', 'existing')))
  })

  it('pins the triage status to "new"', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'feedback', 'triaged'), note({ status: 'resolved' })))
  })

  it('requires the server clock, not one the client picked', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'feedback', 'backdated'), note({ createdAt: new Date(0) })))
  })

  it('holds the message, the category and the rating to the shape the form sends', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'feedback', 'empty'), note({ message: '' })))
    await assertFails(setDoc(doc(asAdmin(), 'feedback', 'huge'), note({ message: 'x'.repeat(FEEDBACK_MESSAGE_MAX + 1) })))
    await assertFails(setDoc(doc(asAdmin(), 'feedback', 'odd-category'), note({ category: 'urgent' })))
    await assertFails(setDoc(doc(asAdmin(), 'feedback', 'rating-0'), note({ rating: 0 })))
    await assertFails(setDoc(doc(asAdmin(), 'feedback', 'rating-9'), note({ rating: 9 })))
    // An unrated note is the normal case, not a rejected one.
    await assertSucceeds(setDoc(doc(asAdmin(), 'feedback', 'unrated'), note({ rating: null })))
  })

  // Unencrypted and append-only by any signed-in member: worth making sure it
  // cannot quietly become general-purpose storage.
  it('refuses a document carrying fields the form never sends', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'feedback', 'smuggled'), note({ payload: 'x'.repeat(5000) })))
    await assertFails(setDoc(doc(asAdmin(), 'feedback', 'no-agent'), { ...note(), userAgent: 'u'.repeat(400) }))
  })
})

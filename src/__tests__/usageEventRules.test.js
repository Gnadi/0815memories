/**
 * Security-rule tests for usage events.
 *
 * Like feedback, the collection is written by every family member and read by
 * nobody, and it is unencrypted — so the shape is what keeps content out of it.
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { readFileSync } from 'node:fs'

const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

const FAMILY = 'family-1'
const OTHER_FAMILY = 'family-2'
const ADMIN = 'uid-admin'
const OTHER_ADMIN = 'uid-other-admin'
const VIEWER = 'uid-viewer'
const DAY_MS = 24 * 60 * 60 * 1000

let testEnv

const event = (overrides = {}) => ({
  familyId: FAMILY,
  role: 'admin',
  name: 'item_created',
  props: { kind: 'memory' },
  lang: 'de',
  standalone: false,
  session: 'abc123',
  createdAt: serverTimestamp(),
  expireAt: Timestamp.fromMillis(Date.now() + 90 * DAY_MS),
  ...overrides,
})

describe.skipIf(!EMULATOR)('Usage event security rules', () => {
  beforeAll(async () => {
    const [host, port] = EMULATOR.split(':')
    testEnv = await initializeTestEnvironment({
      // Its own project id: clearFirestore() wipes a whole project, and vitest
      // runs the rules suites in parallel.
      projectId: 'demo-kaydo-usage-rules',
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
      await setDoc(doc(db, 'usageEvents', 'existing'), { ...event(), createdAt: new Date() })
    })
  })

  const asAdmin = () => testEnv.authenticatedContext(ADMIN, { role: 'admin', familyId: FAMILY }).firestore()
  const asViewer = () => testEnv.authenticatedContext(VIEWER, { role: 'viewer', familyId: FAMILY }).firestore()
  const asOtherAdmin = () => testEnv.authenticatedContext(OTHER_ADMIN, { role: 'admin', familyId: OTHER_FAMILY }).firestore()
  const asVisitor = () => testEnv.unauthenticatedContext().firestore()

  it('lets an admin record an event for their own family', async () => {
    await assertSucceeds(setDoc(doc(asAdmin(), 'usageEvents', 'a'), event()))
  })

  it('lets a viewer record one too', async () => {
    await assertSucceeds(setDoc(doc(asViewer(), 'usageEvents', 'v'), event({ role: 'viewer', name: 'feature_opened', props: { feature: 'feed' } })))
  })

  it('accepts an event with no labels', async () => {
    await assertSucceeds(setDoc(doc(asAdmin(), 'usageEvents', 'bare'), event({ name: 'session_started', props: {} })))
  })

  it('will not let a viewer sign an event as an admin', async () => {
    await assertFails(setDoc(doc(asViewer(), 'usageEvents', 'faked'), event({ role: 'admin' })))
  })

  it('rejects a signed-out visitor', async () => {
    await assertFails(setDoc(doc(asVisitor(), 'usageEvents', 'anon'), event()))
  })

  it('rejects an event filed against a family the sender is not in', async () => {
    await assertFails(setDoc(doc(asOtherAdmin(), 'usageEvents', 'cross'), event()))
  })

  it('is invisible to everyone, its author included', async () => {
    await assertFails(getDoc(doc(asAdmin(), 'usageEvents', 'existing')))
    await assertFails(getDoc(doc(asViewer(), 'usageEvents', 'existing')))
    await assertFails(getDoc(doc(asVisitor(), 'usageEvents', 'existing')))
  })

  it('cannot be edited or withdrawn once recorded', async () => {
    await assertFails(updateDoc(doc(asAdmin(), 'usageEvents', 'existing'), { name: 'family_created' }))
    await assertFails(deleteDoc(doc(asAdmin(), 'usageEvents', 'existing')))
  })

  it('requires the server clock for the time of the event', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'usageEvents', 'backdated'), event({ createdAt: new Date(0) })))
  })

  it('only knows the events the app sends', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'usageEvents', 'odd'), event({ name: 'read_secret' })))
  })

  // The point of the shape: nothing that could be content fits.
  it('refuses labels and fields the app never sends', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'usageEvents', 'title'), event({ props: { title: 'Oma' } })))
    await assertFails(setDoc(doc(asAdmin(), 'usageEvents', 'long'), event({ props: { kind: 'x'.repeat(41) } })))
    await assertFails(setDoc(doc(asAdmin(), 'usageEvents', 'many'), event({ props: { feature: 'a', kind: 'b', reason: 'c', area: 'd' } })))
    await assertFails(setDoc(doc(asAdmin(), 'usageEvents', 'number'), event({ props: { kind: 5 } })))
    await assertFails(setDoc(doc(asAdmin(), 'usageEvents', 'smuggled'), event({ payload: 'x'.repeat(5000) })))
    await assertFails(setDoc(doc(asAdmin(), 'usageEvents', 'uid'), event({ uid: ADMIN })))
  })

  it('keeps events for a bounded time', async () => {
    await assertFails(setDoc(doc(asAdmin(), 'usageEvents', 'forever'), event({ expireAt: Timestamp.fromMillis(Date.now() + 3650 * DAY_MS) })))
    await assertFails(setDoc(doc(asAdmin(), 'usageEvents', 'gone'), event({ expireAt: Timestamp.fromMillis(Date.now() + DAY_MS) })))
  })
})

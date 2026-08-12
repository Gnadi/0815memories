/**
 * Security-rule tests for FCM push tokens.
 *
 * These exist because of a bug that made push notifications do nothing at all,
 * for everyone, without a single visible error: the client stored tokens under
 * an auto-generated id, so before writing it had to *query* `fcmTokens` for an
 * existing document — and `allow read: if false` denies exactly that. The query
 * threw, the write was never reached, the rejection was swallowed, and the
 * collection stayed empty forever.
 *
 * The fix is to make the token itself the document id, which turns the upsert
 * into a pure write. The first two tests pin that shape; the read test pins the
 * rule that made the old approach impossible, so nobody "fixes" a future
 * regression by opening reads back up.
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { readFileSync } from 'node:fs'

// Set by `firebase emulators:exec`; absent during a plain `npm test`.
const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

const FAMILY = 'family-1'
const ADMIN = 'uid-admin'
// Shaped like a real FCM registration token: base64url, no '/'.
const TOKEN = 'fMEP0vJqSQ-abcDEF123456:APA91bHxYz_kQw3rT7uVn8pLmKjHgFdSaZxCvBnM'

let testEnv

const tokenDoc = (overrides = {}) => ({
  familyId: FAMILY,
  token: TOKEN,
  lang: 'de',
  ...overrides,
})

describe.skipIf(!EMULATOR)('fcmTokens security rules', () => {
  beforeAll(async () => {
    const [host, port] = EMULATOR.split(':')
    testEnv = await initializeTestEnvironment({
      // Its own project id — vitest runs files in parallel and clearFirestore()
      // wipes a whole project, so a shared id would delete another suite's data.
      projectId: 'demo-kaydo-fcm-rules',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
    })
  })

  afterAll(async () => {
    await testEnv?.cleanup()
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
  })

  const asAdmin = () => testEnv.authenticatedContext(ADMIN).firestore()
  const asViewer = () => testEnv.unauthenticatedContext().firestore()

  describe('upsert with the token as document id', () => {
    it('accepts a write from a signed-in admin', async () => {
      await assertSucceeds(setDoc(doc(asAdmin(), 'fcmTokens', TOKEN), tokenDoc()))
    })

    it('accepts a write from a viewer, who has no Firebase session', async () => {
      // Viewers log in with a family password, not Firebase Auth. They still
      // need to receive notifications, so this path must stay open.
      await assertSucceeds(setDoc(doc(asViewer(), 'fcmTokens', TOKEN), tokenDoc()))
    })

    it('accepts re-registering the same device (merge on the same id)', async () => {
      await assertSucceeds(setDoc(doc(asAdmin(), 'fcmTokens', TOKEN), tokenDoc()))
      await assertSucceeds(
        setDoc(doc(asAdmin(), 'fcmTokens', TOKEN), tokenDoc({ familyId: 'family-2' }), {
          merge: true,
        })
      )
    })
  })

  describe('rejected writes', () => {
    it('rejects a token parked under a different document id', async () => {
      await assertFails(setDoc(doc(asAdmin(), 'fcmTokens', 'not-the-token'), tokenDoc()))
    })

    it('rejects a document without a token', async () => {
      await assertFails(setDoc(doc(asAdmin(), 'fcmTokens', TOKEN), { familyId: FAMILY }))
    })

    it('rejects a document without a familyId', async () => {
      await assertFails(setDoc(doc(asAdmin(), 'fcmTokens', TOKEN), { token: TOKEN }))
    })

    it('rejects a token longer than a Firestore document id may be', async () => {
      const huge = 'x'.repeat(1500)
      await assertFails(setDoc(doc(asAdmin(), 'fcmTokens', huge), tokenDoc({ token: huge })))
    })
  })

  describe('reads stay closed', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'fcmTokens', TOKEN), tokenDoc())
      })
    })

    it('denies reading a single token document', async () => {
      await assertFails(getDoc(doc(asAdmin(), 'fcmTokens', TOKEN)))
    })

    it('denies the query the old client used — the bug this suite exists for', async () => {
      await assertFails(
        getDocs(query(collection(asAdmin(), 'fcmTokens'), where('token', '==', TOKEN)))
      )
    })

    it("denies listing another family's devices", async () => {
      await assertFails(
        getDocs(query(collection(asViewer(), 'fcmTokens'), where('familyId', '==', FAMILY)))
      )
    })
  })
})

describe.skipIf(EMULATOR)('fcmTokens security rules', () => {
  it('is skipped without the Firestore emulator (run: npm run test:rules)', () => {
    expect(EMULATOR).toBeUndefined()
  })
})

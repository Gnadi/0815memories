/**
 * Security-rule tests for collages and highlight videos.
 *
 * Both collections are admin-only and family-scoped: unlike memories (which are
 * world-readable and rely on client-side encryption), nothing here should be
 * legible to another family's admin, to a signed-out visitor, or to a viewer
 * who only knows the shared family password.
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { readFileSync } from 'node:fs'

const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

const FAMILY = 'family-1'
const OTHER_FAMILY = 'family-2'
const ADMIN = 'uid-admin'
const OTHER_ADMIN = 'uid-other-admin'

// Stands in for encryptText()/encryptJSON() output.
const CIPHERTEXT = 'kJ8xQ2hZbGxvV29ybGRUaGlzSXNCYXNlNjQ='

let testEnv

const creation = (overrides = {}) => ({
  familyId: FAMILY,
  title: CIPHERTEXT,
  doc: CIPHERTEXT,
  createdAt: new Date(),
  ...overrides,
})

describe.skipIf(!EMULATOR)('Collage and highlight security rules', () => {
  beforeAll(async () => {
    const [host, port] = EMULATOR.split(':')
    testEnv = await initializeTestEnvironment({
      // Its own project id: clearFirestore() wipes a whole project, and vitest
      // runs the rules suites in parallel.
      projectId: 'demo-kaydo-collage-rules',
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
      await setDoc(doc(db, 'collages', 'collage-1'), creation())
      await setDoc(doc(db, 'highlights', 'highlight-1'), creation())
    })
  })

  const asAdmin = () => testEnv.authenticatedContext(ADMIN).firestore()
  const asOtherAdmin = () => testEnv.authenticatedContext(OTHER_ADMIN).firestore()
  const asVisitor = () => testEnv.unauthenticatedContext().firestore()

  for (const [collection, id] of [['collages', 'collage-1'], ['highlights', 'highlight-1']]) {
    describe(collection, () => {
      it('lets the family admin read, create, update and delete', async () => {
        await assertSucceeds(getDoc(doc(asAdmin(), collection, id)))
        await assertSucceeds(setDoc(doc(asAdmin(), collection, 'new-one'), creation()))
        await assertSucceeds(updateDoc(doc(asAdmin(), collection, id), { title: CIPHERTEXT }))
        await assertSucceeds(deleteDoc(doc(asAdmin(), collection, id)))
      })

      it('hides it from another family, admin or not', async () => {
        await assertFails(getDoc(doc(asOtherAdmin(), collection, id)))
        await assertFails(updateDoc(doc(asOtherAdmin(), collection, id), { title: CIPHERTEXT }))
        await assertFails(deleteDoc(doc(asOtherAdmin(), collection, id)))
      })

      it('hides it from a signed-out visitor — unlike memories, these are not public', async () => {
        await assertFails(getDoc(doc(asVisitor(), collection, id)))
        await assertFails(setDoc(doc(asVisitor(), collection, 'sneaky'), creation()))
      })

      it('refuses a document created under someone else\'s familyId', async () => {
        await assertFails(
          setDoc(doc(asOtherAdmin(), collection, 'forged'), creation({ familyId: FAMILY }))
        )
      })

      it('refuses a document with no family at all', async () => {
        await assertFails(
          setDoc(doc(asAdmin(), collection, 'orphan'), creation({ familyId: 'no-such-family' }))
        )
      })
    })
  }
})

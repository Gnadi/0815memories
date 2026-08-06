/**
 * Security-rule tests for the rich memory description.
 *
 * Memory documents are world-readable, so the only thing keeping a family's
 * stories private is that the client encrypts before it writes. `contentRich`
 * is the first memory field that is not natively a string, and encryptFields()
 * skips non-strings silently — so the one failure mode that would leak
 * everything without looking broken is a document object reaching Firestore.
 * These tests pin the server-side backstop that rejects it.
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { readFileSync } from 'node:fs'

// Set by `firebase emulators:exec`; absent during a plain `npm test`.
const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

const FAMILY = 'family-1'
const ADMIN = 'uid-admin'
const MEMORY = 'memory-1'

// Stands in for the output of encryptText(): base64, so it can never begin
// with '{' or '['.
const CIPHERTEXT = 'kJ8xQ2hZbGxvV29ybGRUaGlzSXNCYXNlNjQ='

const RICH_DOC = { type: 'doc', content: [{ type: 'paragraph' }] }

let testEnv

const memory = (overrides = {}) => ({
  familyId: FAMILY,
  title: CIPHERTEXT,
  content: CIPHERTEXT,
  date: new Date(),
  ...overrides,
})

describe.skipIf(!EMULATOR)('Memory contentRich security rules', () => {
  beforeAll(async () => {
    const [host, port] = EMULATOR.split(':')
    testEnv = await initializeTestEnvironment({
      // Its own project: vitest runs test files in parallel, and clearFirestore()
      // wipes the whole project — sharing an id with ourYearRules.test.js means
      // each suite deletes the other's fixtures mid-run.
      projectId: 'demo-kaydo-memory-rules',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
    })
  })

  afterAll(async () => {
    await testEnv?.cleanup()
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'families', FAMILY), {
        adminUid: ADMIN,
        adminUids: [ADMIN],
        familyName: 'Test',
      })
    })
  })

  const asAdmin = () => testEnv.authenticatedContext(ADMIN).firestore()

  describe('create', () => {
    it('accepts an encrypted contentRich string', async () => {
      await assertSucceeds(
        setDoc(doc(asAdmin(), 'memories', MEMORY), memory({ contentRich: CIPHERTEXT }))
      )
    })

    it('accepts a memory with no contentRich at all (legacy shape)', async () => {
      await assertSucceeds(setDoc(doc(asAdmin(), 'memories', MEMORY), memory()))
    })

    it('rejects a plaintext document object', async () => {
      await assertFails(
        setDoc(doc(asAdmin(), 'memories', MEMORY), memory({ contentRich: RICH_DOC }))
      )
    })

    it('rejects stringified but unencrypted JSON', async () => {
      await assertFails(
        setDoc(doc(asAdmin(), 'memories', MEMORY), memory({ contentRich: JSON.stringify(RICH_DOC) }))
      )
    })

    it('rejects an unencrypted JSON array', async () => {
      await assertFails(
        setDoc(doc(asAdmin(), 'memories', MEMORY), memory({ contentRich: '[{"type":"doc"}]' }))
      )
    })

    it('rejects a contentRich that is not a string at all', async () => {
      await assertFails(setDoc(doc(asAdmin(), 'memories', MEMORY), memory({ contentRich: 42 })))
      await assertFails(setDoc(doc(asAdmin(), 'memories', MEMORY), memory({ contentRich: [] })))
    })

    it('rejects an empty contentRich', async () => {
      await assertFails(setDoc(doc(asAdmin(), 'memories', MEMORY), memory({ contentRich: '' })))
    })

    it('rejects a contentRich beyond the size cap', async () => {
      await assertFails(
        setDoc(doc(asAdmin(), 'memories', MEMORY), memory({ contentRich: 'a'.repeat(700001) }))
      )
    })
  })

  describe('update', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'memories', MEMORY), memory())
      })
    })

    it('accepts an encrypted contentRich string', async () => {
      await assertSucceeds(
        updateDoc(doc(asAdmin(), 'memories', MEMORY), { contentRich: CIPHERTEXT })
      )
    })

    it('rejects a plaintext document object', async () => {
      await assertFails(updateDoc(doc(asAdmin(), 'memories', MEMORY), { contentRich: RICH_DOC }))
    })

    it('rejects stringified but unencrypted JSON', async () => {
      await assertFails(
        updateDoc(doc(asAdmin(), 'memories', MEMORY), { contentRich: JSON.stringify(RICH_DOC) })
      )
    })

    it('still lets an admin edit other fields', async () => {
      await assertSucceeds(updateDoc(doc(asAdmin(), 'memories', MEMORY), { title: CIPHERTEXT }))
    })
  })

  describe('unchanged behaviour', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(
          doc(context.firestore(), 'memories', MEMORY),
          memory({ contentRich: CIPHERTEXT })
        )
      })
    })

    it('still lets an admin delete a memory carrying contentRich', async () => {
      await assertSucceeds(deleteDoc(doc(asAdmin(), 'memories', MEMORY)))
    })

    it('still denies writes from a non-admin', async () => {
      const outsider = testEnv.authenticatedContext('uid-outsider').firestore()
      await assertFails(updateDoc(doc(outsider, 'memories', MEMORY), { contentRich: CIPHERTEXT }))
    })

    it('still allows unauthenticated reads', async () => {
      const anon = testEnv.unauthenticatedContext().firestore()
      await expect(
        import('firebase/firestore').then(({ getDoc }) => getDoc(doc(anon, 'memories', MEMORY)))
      ).resolves.toBeTruthy()
    })
  })
})

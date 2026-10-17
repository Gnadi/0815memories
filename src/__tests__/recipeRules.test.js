// @vitest-environment node
/**
 * Recipes against the emulator: an admin reads and writes them, a viewer reads
 * the ones an admin has shared and writes nothing, and a fork is always shared
 * exactly when its recipe is. The queries are the ones services/recipes.js
 * makes for a viewer.
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import {
  collection, deleteDoc, deleteField, doc, getDoc, getDocs, orderBy, query, setDoc, Timestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore'
import { readFileSync } from 'node:fs'

// Set by `firebase emulators:exec`; absent during a plain `npm test`.
const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

const FAMILY = 'family-1'
const OTHER_FAMILY = 'family-2'
const ADMIN = 'uid-admin'

let testEnv

const recipe = (extra = {}) => ({
  familyId: FAMILY,
  title: 'ciphertext',
  createdAt: Timestamp.now(),
  parentId: null,
  rootId: null,
  ...extra,
})

describe.skipIf(!EMULATOR)('recipes', () => {
  beforeAll(async () => {
    const [host, port] = EMULATOR.split(':')
    testEnv = await initializeTestEnvironment({
      // Its own project: clearFirestore() wipes the whole project, and vitest
      // runs the rules suites in parallel.
      projectId: 'demo-kaydo-recipe-rules',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
    })
  })

  afterAll(async () => {
    await testEnv?.cleanup()
  })

  // A shared recipe with a fork, and a private one with a fork.
  beforeEach(async () => {
    await testEnv.clearFirestore()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore()
      await setDoc(doc(db, 'families', FAMILY), { adminUid: ADMIN, adminUids: [ADMIN] })
      await setDoc(doc(db, 'families', OTHER_FAMILY), { adminUid: 'uid-other', adminUids: ['uid-other'] })
      await setDoc(doc(db, 'recipes', 'shared'), recipe({ viewerVisible: true }))
      await setDoc(doc(db, 'recipes', 'sharedFork'), recipe({ viewerVisible: true, parentId: 'shared', rootId: 'shared' }))
      await setDoc(doc(db, 'recipes', 'private'), recipe({ viewerVisible: false }))
      await setDoc(doc(db, 'recipes', 'privateFork'), recipe({ parentId: 'private', rootId: 'private' }))
    })
  })

  const asAdmin = () => testEnv.authenticatedContext(ADMIN, { familyId: FAMILY, role: 'admin' }).firestore()
  const asViewer = (familyId = FAMILY) =>
    testEnv.authenticatedContext(`viewer:${familyId}`, { familyId, role: 'viewer' }).firestore()

  describe('a viewer reads', () => {
    it('the list of shared versions, as subscribeRecipes asks for it', async () => {
      await assertSucceeds(getDocs(query(
        collection(asViewer(), 'recipes'),
        where('familyId', '==', FAMILY),
        where('viewerVisible', '==', true),
        orderBy('createdAt', 'desc'),
      )))
    })

    it('a shared recipe and its forks, as getRecipeLineage asks for them', async () => {
      await assertSucceeds(getDoc(doc(asViewer(), 'recipes', 'shared')))
      await assertSucceeds(getDoc(doc(asViewer(), 'recipes', 'sharedFork')))
      await assertSucceeds(getDocs(query(
        collection(asViewer(), 'recipes'),
        where('familyId', '==', FAMILY),
        where('rootId', '==', 'shared'),
        where('viewerVisible', '==', true),
      )))
    })
  })

  describe('a viewer does not read', () => {
    it('a list that does not ask for shared versions only', async () => {
      await assertFails(getDocs(query(collection(asViewer(), 'recipes'), where('familyId', '==', FAMILY))))
    })

    it('a recipe that is not shared, or its forks', async () => {
      await assertFails(getDoc(doc(asViewer(), 'recipes', 'private')))
      await assertFails(getDoc(doc(asViewer(), 'recipes', 'privateFork')))
    })

    it("another family's shared recipe", async () => {
      await assertFails(getDoc(doc(asViewer(OTHER_FAMILY), 'recipes', 'shared')))
    })
  })

  describe('a viewer writes nothing', () => {
    it('neither changes nor deletes a shared recipe', async () => {
      await assertFails(updateDoc(doc(asViewer(), 'recipes', 'shared'), { title: 'changed' }))
      await assertFails(deleteDoc(doc(asViewer(), 'recipes', 'shared')))
    })

    it('neither adds a recipe nor forks a shared one', async () => {
      await assertFails(setDoc(doc(asViewer(), 'recipes', 'new'), recipe({ viewerVisible: true })))
      await assertFails(setDoc(doc(asViewer(), 'recipes', 'newFork'),
        recipe({ viewerVisible: true, parentId: 'shared', rootId: 'shared' })))
    })

    it('does not share a recipe', async () => {
      await assertFails(updateDoc(doc(asViewer(), 'recipes', 'private'), { viewerVisible: true }))
    })
  })

  describe('a fork is shared exactly when its recipe is', () => {
    it('a fork of a shared recipe has to be shared', async () => {
      await assertFails(setDoc(doc(asAdmin(), 'recipes', 'f1'),
        recipe({ parentId: 'sharedFork', rootId: 'shared' })))
      await assertSucceeds(setDoc(doc(asAdmin(), 'recipes', 'f2'),
        recipe({ viewerVisible: true, parentId: 'sharedFork', rootId: 'shared' })))
    })

    it('a fork of a private recipe cannot be', async () => {
      await assertFails(setDoc(doc(asAdmin(), 'recipes', 'f3'),
        recipe({ viewerVisible: true, parentId: 'private', rootId: 'private' })))
    })

    it('a fork cannot be shared on its own', async () => {
      await assertFails(updateDoc(doc(asAdmin(), 'recipes', 'privateFork'), { viewerVisible: true }))
    })

    it('a recipe is shared and unshared with its forks in one batch', async () => {
      const db = asAdmin()
      const share = writeBatch(db)
      share.update(doc(db, 'recipes', 'privateFork'), { viewerVisible: true })
      share.update(doc(db, 'recipes', 'private'), { viewerVisible: true })
      await assertSucceeds(share.commit())

      const unshare = writeBatch(db)
      unshare.update(doc(db, 'recipes', 'sharedFork'), { viewerVisible: false })
      unshare.update(doc(db, 'recipes', 'shared'), { viewerVisible: false })
      await assertSucceeds(unshare.commit())
    })

    it('the flag is a yes or a no', async () => {
      await assertFails(updateDoc(doc(asAdmin(), 'recipes', 'private'), { viewerVisible: 'yes' }))
    })
  })

  describe('an admin', () => {
    it('adds a family recipe, shared or not', async () => {
      await assertSucceeds(setDoc(doc(asAdmin(), 'recipes', 'r1'), recipe({ viewerVisible: false })))
      await assertSucceeds(setDoc(doc(asAdmin(), 'recipes', 'r2'), recipe({ viewerVisible: true })))
    })

    it('reads every recipe, shared or not', async () => {
      await assertSucceeds(getDocs(query(
        collection(asAdmin(), 'recipes'), where('familyId', '==', FAMILY), orderBy('createdAt', 'desc'),
      )))
    })

    it('still changes a recipe from before sharing, with no rootId or flag at all', async () => {
      await testEnv.withSecurityRulesDisabled((context) =>
        setDoc(doc(context.firestore(), 'recipes', 'legacy'), { familyId: FAMILY, title: 'ciphertext' }))
      await assertSucceeds(updateDoc(doc(asAdmin(), 'recipes', 'legacy'), { viewerVisible: true }))
    })
  })

  describe('instructions', () => {
    it('are stored rich, encrypted, or as Markdown', async () => {
      await assertSucceeds(setDoc(doc(asAdmin(), 'recipes', 'rich'), recipe({
        viewerVisible: false, instructionsFormat: 'rich', instructionsRich: 'Y2lwaGVydGV4dA==', instructions: 'ciphertext',
      })))
      await assertSucceeds(setDoc(doc(asAdmin(), 'recipes', 'md'), recipe({
        viewerVisible: false, instructionsFormat: 'markdown', instructions: 'ciphertext',
      })))
    })

    it('are refused as a readable rich document', async () => {
      const document = { type: 'doc', content: [] }
      await assertFails(setDoc(doc(asAdmin(), 'recipes', 'map'), recipe({ viewerVisible: false, instructionsRich: document })))
      await assertFails(setDoc(doc(asAdmin(), 'recipes', 'json'), recipe({
        viewerVisible: false, instructionsRich: JSON.stringify(document),
      })))
      await assertFails(updateDoc(doc(asAdmin(), 'recipes', 'private'), { instructionsRich: JSON.stringify(document) }))
    })

    it('are corrected by an admin, on a recipe and on a fork', async () => {
      await assertSucceeds(updateDoc(doc(asAdmin(), 'recipes', 'shared'), {
        title: 'ciphertext', instructionsFormat: 'markdown', instructions: 'ciphertext', instructionsRich: deleteField(),
      }))
      await assertSucceeds(updateDoc(doc(asAdmin(), 'recipes', 'sharedFork'), {
        title: 'ciphertext', instructionsFormat: 'rich', instructionsRich: 'Y2lwaGVydGV4dA==',
      }))
      await assertFails(updateDoc(doc(asViewer(), 'recipes', 'sharedFork'), { title: 'ciphertext' }))
    })

    it('are in a format the app can read', async () => {
      await assertFails(setDoc(doc(asAdmin(), 'recipes', 'html'), recipe({ viewerVisible: false, instructionsFormat: 'html' })))
    })
  })
})

// @vitest-environment node
/**
 * Family addresses — functions/slugs.js against the emulator.
 *
 * A family is found by its slug (`<slug>.kaydo.app`), and uniqueness used to
 * be checked only by the browser. Any signed-in client could create a family
 * carrying another family's slug under a document id that sorts first, and the
 * login page would resolve the address to that family instead. The registry in
 * `familySlugs` is what the mirror trigger now consults before it publishes a
 * slug to familyPublic.
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { claimFamilySlug, publicSlugFor, SLUGS } from '../../functions/slugs.js'

// Set by `firebase emulators:exec`; absent during a plain `npm test`.
const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

let testEnv
let adminApp
let db

const holderOf = async (slug) => (await db.collection(SLUGS).doc(slug).get()).data()?.familyId ?? null

describe.skipIf(!EMULATOR)('family slugs', () => {
  beforeAll(async () => {
    const [host, port] = EMULATOR.split(':')
    testEnv = await initializeTestEnvironment({
      // Its own project: clearFirestore() wipes the whole project, and vitest
      // runs the rules suites in parallel.
      projectId: 'demo-kaydo-slug-rules',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
    })
    // The Admin SDK finds the emulator through FIRESTORE_EMULATOR_HOST.
    adminApp = initializeApp({ projectId: 'demo-kaydo-slug-rules' }, 'family-slug-rules')
    db = getFirestore(adminApp)
  })

  afterAll(async () => {
    await testEnv?.cleanup()
    if (adminApp) await deleteApp(adminApp)
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
  })

  describe('claiming', () => {
    it('gives a free slug to the first family to ask', async () => {
      expect(await claimFamilySlug(db, 'fam-a', 'the-millers')).toBe(true)
      expect(await holderOf('the-millers')).toBe('fam-a')
    })

    it('refuses a slug another family holds, whatever its document id', async () => {
      await claimFamilySlug(db, 'fam-z', 'the-millers')
      // '0000' sorts before 'fam-z' — the id an attacker would pick to be the
      // first match on the login page.
      expect(await claimFamilySlug(db, '0000', 'the-millers')).toBe(false)
      expect(await holderOf('the-millers')).toBe('fam-z')
    })

    it('is idempotent for the holder', async () => {
      await claimFamilySlug(db, 'fam-a', 'the-millers')
      expect(await claimFamilySlug(db, 'fam-a', 'the-millers')).toBe(true)
    })

    it('protects a family from before the registry, known only by its mirror', async () => {
      await db.doc('familyPublic/fam-legacy').set({ familySlug: 'the-millers' })
      expect(await claimFamilySlug(db, '0000', 'the-millers')).toBe(false)
      expect(await holderOf('the-millers')).toBe(null)
      // …and lets that family register it on its next write.
      expect(await claimFamilySlug(db, 'fam-legacy', 'the-millers')).toBe(true)
      expect(await holderOf('the-millers')).toBe('fam-legacy')
    })

    it('refuses anything generateSlug() would not have produced', async () => {
      expect(await claimFamilySlug(db, 'fam-a', '__reserved__')).toBe(false)
      expect(await claimFamilySlug(db, 'fam-a', 'a/b')).toBe(false)
      expect(await claimFamilySlug(db, 'fam-a', '')).toBe(false)
    })
  })

  describe('the slug the public mirror carries', () => {
    it('follows a rename and gives the old slug back', async () => {
      await claimFamilySlug(db, 'fam-a', 'the-millers')
      expect(await publicSlugFor(db, 'fam-a', 'the-miller-clan', 'the-millers')).toBe('the-miller-clan')
      expect(await holderOf('the-millers')).toBe(null)
      expect(await holderOf('the-miller-clan')).toBe('fam-a')
    })

    it('keeps the current address when a rename is refused', async () => {
      await claimFamilySlug(db, 'fam-a', 'the-millers')
      await claimFamilySlug(db, 'fam-b', 'the-smiths')
      expect(await publicSlugFor(db, 'fam-a', 'the-smiths', 'the-millers')).toBe('the-millers')
      expect(await holderOf('the-smiths')).toBe('fam-b')
    })

    it('is nothing for a family that copied someone else\'s slug', async () => {
      await claimFamilySlug(db, 'fam-a', 'the-millers')
      expect(await publicSlugFor(db, '0000', 'the-millers', undefined)).toBe(null)
    })

    it('releases the slug when it is cleared', async () => {
      await claimFamilySlug(db, 'fam-a', 'the-millers')
      expect(await publicSlugFor(db, 'fam-a', undefined, 'the-millers')).toBe(null)
      expect(await holderOf('the-millers')).toBe(null)
    })
  })

  describe('the lookup the login page makes', () => {
    beforeEach(async () => {
      await claimFamilySlug(db, 'fam-a', 'the-millers')
      await claimFamilySlug(db, 'fam-b', 'the-smiths')
      await db.doc('familyPublic/fam-a').set({ familySlug: 'the-millers', familyName: 'The Millers' })
      await db.doc('familyPublic/fam-b').set({ familySlug: 'the-smiths', familyName: 'The Smiths' })
    })

    it('finds a family by address without an account: registry first, then its public copy', async () => {
      const anon = testEnv.unauthenticatedContext().firestore()
      const claim = await assertSucceeds(getDoc(doc(anon, SLUGS, 'the-millers')))
      expect(claim.data().familyId).toBe('fam-a')
      const found = await assertSucceeds(getDoc(doc(anon, 'familyPublic', claim.data().familyId)))
      expect(found.data().familyName).toBe('The Millers')
    })

    it('cannot list the families of the project', async () => {
      const anon = testEnv.unauthenticatedContext().firestore()
      await assertFails(getDocs(collection(anon, 'familyPublic')))
      await assertFails(getDocs(query(collection(anon, 'familyPublic'), where('familySlug', '==', 'the-millers'))))
      await assertFails(getDocs(collection(anon, SLUGS)))
      // Signing in does not change that.
      const member = testEnv.authenticatedContext('uid-a', { familyId: 'fam-a', role: 'admin' }).firestore()
      await assertFails(getDocs(collection(member, 'familyPublic')))
      await assertFails(getDocs(collection(member, SLUGS)))
    })
  })

  it('is read-only for clients', async () => {
    await claimFamilySlug(db, 'fam-a', 'the-millers')
    const client = testEnv.authenticatedContext('uid-a', { familyId: 'fam-a', role: 'admin' }).firestore()
    await assertSucceeds(getDoc(doc(client, SLUGS, 'the-millers')))
    await assertFails(setDoc(doc(client, SLUGS, 'the-smiths'), { familyId: 'fam-a' }))
    await assertFails(setDoc(doc(client, SLUGS, 'the-millers'), { familyId: 'fam-z' }))
    await assertFails(setDoc(doc(client, 'familyPublic', 'fam-a'), { familySlug: 'the-millers', familyName: 'Hijacked' }))
  })
})

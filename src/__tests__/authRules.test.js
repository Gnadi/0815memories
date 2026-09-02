/**
 * Security-rule tests for who may read a family's data at all.
 *
 * These cover the change described in docs/plan-a-zugriffskontrolle.md. Before
 * it, `families`, `memories`, `moments` and `albums` were all `allow read: if
 * true` — because a viewer had no identity Firestore could check, so the only
 * way to let viewers read was to let everyone read. The family document carries
 * `encryptionKeyJwk`, so "everyone" included the encryption key, and the login
 * page handed out the family id needed to fetch it.
 *
 * A viewer now signs in with a custom token carrying `{ familyId, role }`,
 * minted by the viewerLogin Cloud Function after it checks the shared password.
 * That claim is what these rules read.
 *
 * The properties worth holding on to:
 *
 *   1. A stranger reads nothing — not the family, not the feed.
 *   2. A viewer reads their own family and only their own family.
 *   3. A viewer never writes, and never crosses into admin-only collections.
 *   4. The login page still works without a token, via familyPublic.
 *   5. Pending invites cannot be enumerated, because the id *is* the credential.
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  Timestamp,
} from 'firebase/firestore'
import { readFileSync } from 'node:fs'

// Set by `firebase emulators:exec`; absent during a plain `npm test`.
const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

const FAMILY = 'family-1'
const OTHER_FAMILY = 'family-2'
const ADMIN = 'uid-admin'
const OUTSIDER = 'uid-outsider'
const VIEWER = `viewer:${FAMILY}`
const OTHER_VIEWER = `viewer:${OTHER_FAMILY}`

let testEnv

/** A signed-in context carrying the claims the Cloud Functions mint. */
const asViewer = (uid, familyId) =>
  testEnv.authenticatedContext(uid, { familyId, role: 'viewer' }).firestore()

const asAdmin = (uid, familyId) =>
  testEnv.authenticatedContext(uid, { familyId, role: 'admin' }).firestore()

/** An admin from before the claim migration: in adminUids, no claim. */
const asClaimlessAdmin = (uid) => testEnv.authenticatedContext(uid).firestore()

const asStranger = () => testEnv.unauthenticatedContext().firestore()

describe.skipIf(!EMULATOR)('access control rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-kaydo',
      firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    })
  })

  afterAll(async () => {
    await testEnv?.cleanup()
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()

      await setDoc(doc(db, 'families', FAMILY), {
        adminUid: ADMIN,
        adminUids: [ADMIN],
        familyName: 'The Millers',
        familySlug: 'the-millers',
        encryptionKeyJwk: { k: 'the-secret-key', kty: 'oct' },
      })
      await setDoc(doc(db, 'families', OTHER_FAMILY), {
        adminUid: 'uid-admin-2',
        adminUids: ['uid-admin-2'],
        familyName: 'The Others',
        familySlug: 'the-others',
        encryptionKeyJwk: { k: 'other-secret', kty: 'oct' },
      })

      // What the mirror trigger writes: the login page's fields, no secrets.
      await setDoc(doc(db, 'familyPublic', FAMILY), {
        familyName: 'The Millers',
        familySlug: 'the-millers',
        loginPageMode: 'classic',
      })

      await setDoc(doc(db, 'families', FAMILY, 'secrets', 'auth'), {
        sharedPassword: '$2a$10$notarealhash',
      })

      await setDoc(doc(db, 'memories', 'mem-1'), {
        familyId: FAMILY,
        title: 'ciphertext',
        images: ['https://res.cloudinary.com/demo/raw/upload/encrypted.dat'],
      })
      await setDoc(doc(db, 'memories', 'mem-other'), {
        familyId: OTHER_FAMILY,
        title: 'ciphertext',
      })
      await setDoc(doc(db, 'moments', 'moment-1'), { familyId: FAMILY, caption: 'ciphertext' })
      await setDoc(doc(db, 'journals', 'journal-1'), { familyId: FAMILY, content: 'ciphertext' })

      await setDoc(doc(db, 'families', FAMILY, 'invites', 'invite-token-1'), {
        createdBy: ADMIN,
        used: false,
        redeemedBy: null,
        expiresAt: Timestamp.fromDate(new Date(Date.now() + 86_400_000)),
      })
    })
  })

  // ── 1. The stranger ───────────────────────────────────────────────────────
  //
  // This is the finding that started the whole change, turned into a test. Each
  // of these used to succeed.

  describe('a stranger with no token', () => {
    it('cannot read the family document, which holds the encryption key', async () => {
      await assertFails(getDoc(doc(asStranger(), 'families', FAMILY)))
    })

    it('cannot look the family up by slug either', async () => {
      await assertFails(
        getDocs(query(collection(asStranger(), 'families'), where('familySlug', '==', 'the-millers'))),
      )
    })

    it('cannot read a memory, which carries the media URLs in clear text', async () => {
      await assertFails(getDoc(doc(asStranger(), 'memories', 'mem-1')))
    })

    it('cannot list the whole memories collection', async () => {
      await assertFails(getDocs(collection(asStranger(), 'memories')))
    })

    it('cannot read moments', async () => {
      await assertFails(getDoc(doc(asStranger(), 'moments', 'moment-1')))
    })

    it('cannot reach the shared-password hash', async () => {
      await assertFails(getDoc(doc(asStranger(), 'families', FAMILY, 'secrets', 'auth')))
    })
  })

  // ── 2. The login page ─────────────────────────────────────────────────────

  describe('the login page, before anyone signs in', () => {
    it('resolves a family by slug through familyPublic', async () => {
      const snap = await assertSucceeds(
        getDocs(
          query(collection(asStranger(), 'familyPublic'), where('familySlug', '==', 'the-millers')),
        ),
      )
      expect(snap.docs[0].id).toBe(FAMILY)
    })

    it('finds no secret there to read', async () => {
      const snap = await getDoc(doc(asStranger(), 'familyPublic', FAMILY))
      expect(snap.data().encryptionKeyJwk).toBeUndefined()
      expect(snap.data().sharedPassword).toBeUndefined()
    })

    it('cannot write to the mirror', async () => {
      await assertFails(
        setDoc(doc(asStranger(), 'familyPublic', FAMILY), { familyName: 'Hijacked' }),
      )
    })
  })

  // ── 3. The viewer ─────────────────────────────────────────────────────────

  describe('a viewer of this family', () => {
    it('reads the family document, and so gets the encryption key', async () => {
      const snap = await assertSucceeds(getDoc(doc(asViewer(VIEWER, FAMILY), 'families', FAMILY)))
      expect(snap.data().encryptionKeyJwk).toBeDefined()
    })

    it('reads the feed when the query is scoped to the family', async () => {
      await assertSucceeds(
        getDocs(
          query(collection(asViewer(VIEWER, FAMILY), 'memories'), where('familyId', '==', FAMILY)),
        ),
      )
    })

    it('cannot list memories without the family filter', async () => {
      // Rules are not a filter: the unscoped query returns another family's
      // document too, and one denied document fails the whole read.
      await assertFails(getDocs(collection(asViewer(VIEWER, FAMILY), 'memories')))
    })

    it('cannot write a memory', async () => {
      await assertFails(
        setDoc(doc(asViewer(VIEWER, FAMILY), 'memories', 'mem-new'), { familyId: FAMILY }),
      )
    })

    it('cannot read admin-only collections', async () => {
      await assertFails(getDoc(doc(asViewer(VIEWER, FAMILY), 'journals', 'journal-1')))
    })

    it('cannot queue a push notification to the family', async () => {
      await assertFails(
        setDoc(doc(asViewer(VIEWER, FAMILY), 'notificationsQueue', 'q-1'), {
          familyId: FAMILY,
          title: 'Anything',
        }),
      )
    })

    it('cannot redeem a pending invite and become an admin', async () => {
      await assertFails(
        updateDoc(doc(asViewer(VIEWER, FAMILY), 'families', FAMILY, 'invites', 'invite-token-1'), {
          used: true,
          redeemedBy: VIEWER,
        }),
      )
    })
  })

  describe('a viewer of another family', () => {
    it('cannot read this family document', async () => {
      await assertFails(
        getDoc(doc(asViewer(OTHER_VIEWER, OTHER_FAMILY), 'families', FAMILY)),
      )
    })

    it('cannot read this family feed', async () => {
      await assertFails(
        getDocs(
          query(
            collection(asViewer(OTHER_VIEWER, OTHER_FAMILY), 'memories'),
            where('familyId', '==', FAMILY),
          ),
        ),
      )
    })
  })

  // ── 4. The admin ──────────────────────────────────────────────────────────

  describe('an admin', () => {
    it('reads and writes their own family', async () => {
      const db = asAdmin(ADMIN, FAMILY)
      await assertSucceeds(getDoc(doc(db, 'families', FAMILY)))
      await assertSucceeds(getDoc(doc(db, 'journals', 'journal-1')))
      await assertSucceeds(
        setDoc(doc(db, 'memories', 'mem-new'), { familyId: FAMILY, title: 'ciphertext' }),
      )
    })

    it('is still let in without a claim, via adminUids', async () => {
      // The fallback that keeps admins working through the rollout, before the
      // claim trigger has written to their account.
      await assertSucceeds(getDoc(doc(asClaimlessAdmin(ADMIN), 'families', FAMILY)))
    })

    it('cannot read another family', async () => {
      await assertFails(getDoc(doc(asAdmin(ADMIN, FAMILY), 'families', OTHER_FAMILY)))
    })

    it('may queue a push notification for their own family', async () => {
      await assertSucceeds(
        setDoc(doc(asAdmin(ADMIN, FAMILY), 'notificationsQueue', 'q-1'), {
          familyId: FAMILY,
          title: 'New memory added',
        }),
      )
    })
  })

  // ── 5. Invites ────────────────────────────────────────────────────────────

  describe('pending invites', () => {
    it('can be read by anyone holding the exact link', async () => {
      await assertSucceeds(
        getDoc(doc(asStranger(), 'families', FAMILY, 'invites', 'invite-token-1')),
      )
    })

    it('cannot be enumerated, because listing them lists usable credentials', async () => {
      await assertFails(getDocs(collection(asStranger(), 'families', FAMILY, 'invites')))
      await assertFails(
        getDocs(collection(asViewer(VIEWER, FAMILY), 'families', FAMILY, 'invites')),
      )
    })

    it('can be listed by an admin of the family', async () => {
      await assertSucceeds(
        getDocs(collection(asAdmin(ADMIN, FAMILY), 'families', FAMILY, 'invites')),
      )
    })
  })
})

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
 *   5. A push token belongs to a family, and no client ever reads one back.
 *   6. Pending invites cannot be enumerated, because the id *is* the credential.
 *   7. The encryption key, once written with the family, is never replaced or
 *      removed — that would make everything the family stored unreadable.
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
  deleteDoc,
  deleteField,
  updateDoc,
  where,
  writeBatch,
  arrayUnion,
  arrayRemove,
  increment,
  Timestamp,
} from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { CIPHERTEXT, sealed } from './fakeCiphertext'

// Set by `firebase emulators:exec`; absent during a plain `npm test`.
const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

const FAMILY = 'family-1'
const OTHER_FAMILY = 'family-2'
const ADMIN = 'uid-admin'
const OUTSIDER = 'uid-outsider'
const VIEWER = `viewer:${FAMILY}`
const OTHER_VIEWER = `viewer:${OTHER_FAMILY}`

let testEnv

// The id notifications.js gives a device's document: the token's SHA-256, hex.
const tokenId = (token) => createHash('sha256').update(token).digest('hex')
// What generateInviteToken writes: 43 URL-safe characters.
const INVITE_ID = 'A'.repeat(43)

/** A signed-in context carrying the claims the Cloud Functions mint. */
const asViewer = (uid, familyId) =>
  testEnv.authenticatedContext(uid, { familyId, role: 'viewer' }).firestore()

const asAdmin = (uid, familyId) =>
  testEnv.authenticatedContext(uid, { familyId, role: 'admin' }).firestore()

/** An admin from before the claim migration: in adminUids, no claim. */
const asClaimlessAdmin = (uid) => testEnv.authenticatedContext(uid).firestore()

/**
 * A fresh email/password account, as Firebase Auth issues it: no claims yet,
 * and `email_verified` as the account stands.
 */
const asNewAccount = (uid, { verified = true } = {}) =>
  testEnv.authenticatedContext(uid, { email_verified: verified }).firestore()

const asStranger = () => testEnv.unauthenticatedContext().firestore()

describe.skipIf(!EMULATOR)('access control rules', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-kaydo-auth-rules',
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
      // …and the registry entry it keeps for the address.
      await setDoc(doc(db, 'familySlugs', 'the-millers'), { familyId: FAMILY })

      await setDoc(doc(db, 'families', FAMILY, 'secrets', 'auth'), {
        sharedPassword: '$2a$10$notarealhash',
      })

      await setDoc(doc(db, 'memories', 'mem-1'), {
        familyId: FAMILY,
        title: CIPHERTEXT,
        images: ['https://res.cloudinary.com/demo/raw/upload/encrypted.dat'],
      })
      await setDoc(doc(db, 'memories', 'mem-other'), {
        familyId: OTHER_FAMILY,
        title: CIPHERTEXT,
      })
      await setDoc(doc(db, 'moments', 'moment-1'), { familyId: FAMILY, caption: 'ciphertext' })
      await setDoc(doc(db, 'journals', 'journal-1'), { familyId: FAMILY, content: CIPHERTEXT })

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
    it('resolves a family by slug through the registry and familyPublic, document by document', async () => {
      const claim = await assertSucceeds(getDoc(doc(asStranger(), 'familySlugs', 'the-millers')))
      expect(claim.data().familyId).toBe(FAMILY)
      const snap = await assertSucceeds(getDoc(doc(asStranger(), 'familyPublic', claim.data().familyId)))
      expect(snap.data().familySlug).toBe('the-millers')
    })

    it('cannot list the families, with or without a filter', async () => {
      await assertFails(getDocs(collection(asStranger(), 'familyPublic')))
      await assertFails(
        getDocs(query(collection(asStranger(), 'familyPublic'), where('familySlug', '==', 'the-millers'))),
      )
      await assertFails(getDocs(collection(asStranger(), 'familySlugs')))
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
      // The collection is retired — the client no longer composes push text —
      // but the rule has to keep saying no to anything still writing to it.
      await assertFails(
        setDoc(doc(asViewer(VIEWER, FAMILY), 'notificationsQueue', 'q-1'), {
          familyId: FAMILY,
          title: sealed('Anything'),
        }),
      )
    })

    it('may register their own device for push', async () => {
      await assertSucceeds(
        setDoc(doc(asViewer(VIEWER, FAMILY), 'fcmTokens', tokenId('fcm-token-viewer')), {
          familyId: FAMILY,
          token: 'fcm-token-viewer',
          uid: VIEWER,
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
        setDoc(doc(db, 'memories', 'mem-new'), { familyId: FAMILY, title: CIPHERTEXT }),
      )
    })

    it('is no longer let in on a claim the family document does not back', async () => {
      // Removed from adminUids, but the claim in the ID token they still hold
      // says admin. Their access ends with the membership, not with the token.
      const removed = asAdmin('uid-removed', FAMILY)
      await assertFails(getDoc(doc(removed, 'families', FAMILY)))
      await assertFails(getDoc(doc(removed, 'journals', 'journal-1')))
      await assertFails(deleteDoc(doc(removed, 'memories', 'mem-1')))
      await assertSucceeds(deleteDoc(doc(asAdmin(ADMIN, FAMILY), 'memories', 'mem-1')))
    })

    it('is still let in without a claim, via adminUids', async () => {
      // The fallback that keeps admins working through the rollout, before the
      // claim trigger has written to their account.
      await assertSucceeds(getDoc(doc(asClaimlessAdmin(ADMIN), 'families', FAMILY)))
    })

    it('cannot read another family', async () => {
      await assertFails(getDoc(doc(asAdmin(ADMIN, FAMILY), 'families', OTHER_FAMILY)))
    })

    // The lookup AuthContext makes at sign-in for an admin without a claim
    // (api/cloudinary-sign, since removed, made it too). The read rule cannot answer a query — its get()
    // needs a concrete familyId — so this was refused for everyone, and an admin
    // without a claim could neither sign in on a new device nor upload.
    it('finds their own family by adminUids, with or without a claim', async () => {
      for (const db of [asAdmin(ADMIN, FAMILY), asClaimlessAdmin(ADMIN)]) {
        const snap = await assertSucceeds(
          getDocs(query(collection(db, 'families'), where('adminUids', 'array-contains', ADMIN))),
        )
        expect(snap.docs.map((d) => d.id)).toEqual([FAMILY])
      }
    })

    it('no longer finds a family by its owner field alone', async () => {
      // Every family carries adminUids; the lookup by `adminUid` was for the
      // ones from before it.
      const db = asClaimlessAdmin(ADMIN)
      await assertFails(getDocs(query(collection(db, 'families'), where('adminUid', '==', ADMIN))))
    })

    it('cannot look families up by anyone else, or list them unfiltered', async () => {
      const db = asClaimlessAdmin(ADMIN)
      await assertFails(getDocs(query(collection(db, 'families'), where('adminUids', 'array-contains', 'uid-admin-2'))))
      await assertFails(getDocs(query(collection(db, 'families'), where('adminUid', '==', 'uid-admin-2'))))
      await assertFails(getDocs(collection(db, 'families')))
      await assertFails(getDocs(query(collection(asStranger(), 'families'), where('adminUids', 'array-contains', ADMIN))))
    })

    it('can no longer queue a push notification', async () => {
      // notificationsQueue was how a client asked for a push, carrying the
      // plaintext title of an encrypted memory. The triggers compose the text
      // server-side now, and nothing may write here.
      await assertFails(
        setDoc(doc(asAdmin(ADMIN, FAMILY), 'notificationsQueue', 'q-1'), {
          familyId: FAMILY,
          title: sealed('New memory added'),
        }),
      )
    })
  })

  // ── 5. Push tokens ────────────────────────────────────────────────────────

  describe('push tokens', () => {
    it('are written by an admin of the family', async () => {
      await assertSucceeds(
        setDoc(doc(asAdmin(ADMIN, FAMILY), 'fcmTokens', tokenId('fcm-token-admin')), {
          familyId: FAMILY,
          token: 'fcm-token-admin',
          uid: ADMIN,
        }),
      )
    })

    it('are not written by a stranger', async () => {
      // They used to be: the rule asked only for a well-formed shape, because
      // viewers had no identity to check. They have one now.
      await assertFails(
        setDoc(doc(asStranger(), 'fcmTokens', tokenId('fcm-token-stranger')), {
          familyId: FAMILY,
          token: 'fcm-token-stranger',
          uid: 'anyone',
        }),
      )
    })

    it('cannot be registered for someone else\'s family', async () => {
      await assertFails(
        setDoc(doc(asViewer(OTHER_VIEWER, OTHER_FAMILY), 'fcmTokens', tokenId('fcm-token-x')), {
          familyId: FAMILY,
          token: 'fcm-token-x',
          uid: OTHER_VIEWER,
        }),
      )
    })

    it('are never readable by a client', async () => {
      // The whole reason the document id is derived from the token: the client
      // cannot look one up, so it must be able to compute where to write.
      await assertFails(getDoc(doc(asAdmin(ADMIN, FAMILY), 'fcmTokens', tokenId('fcm-token-admin'))))
    })

    it('carry the writer’s own uid and only the fields the client writes', async () => {
      const admin = asAdmin(ADMIN, FAMILY)
      const base = { familyId: FAMILY, token: 'fcm-token-shape', lang: 'de', uid: ADMIN }
      const ref = (data) => doc(admin, 'fcmTokens', tokenId(data.token))
      await assertSucceeds(setDoc(ref(base), { ...base, updatedAt: new Date() }))
      await assertFails(setDoc(ref(base), { ...base, uid: 'someone-else' }))
      await assertFails(setDoc(ref(base), { familyId: FAMILY, token: base.token }))
      await assertFails(setDoc(ref(base), { ...base, extra: 'x' }))
      const long = { ...base, token: 'x'.repeat(4096) }
      await assertFails(setDoc(ref(long), long))
    })

    it('live under the hash of their token, whatever the writer would like to call them', async () => {
      const admin = asAdmin(ADMIN, FAMILY)
      const base = { familyId: FAMILY, token: 'fcm-token-id', uid: ADMIN }
      await assertSucceeds(setDoc(doc(admin, 'fcmTokens', tokenId(base.token)), base))
      await assertFails(setDoc(doc(admin, 'fcmTokens', 'token-hash-chosen'), base))
      // Not the hash of some other token either, nor its uppercase spelling.
      await assertFails(setDoc(doc(admin, 'fcmTokens', tokenId('another-token')), base))
      await assertFails(setDoc(doc(admin, 'fcmTokens', tokenId(base.token).toUpperCase()), base))
    })

    it('are written in a language the notifications exist in', async () => {
      const admin = asAdmin(ADMIN, FAMILY)
      const base = { familyId: FAMILY, token: 'fcm-token-lang', uid: ADMIN }
      const ref = doc(admin, 'fcmTokens', tokenId(base.token))
      await assertFails(setDoc(ref, { ...base, lang: 'x'.repeat(100_000) }))
      await assertFails(setDoc(ref, { ...base, lang: 'fr' }))
      await assertSucceeds(setDoc(ref, { ...base, lang: 'en' }))
      await assertSucceeds(setDoc(ref, { ...base, lang: 'de' }))
    })

    it('stay with the family that registered them', async () => {
      const base = { familyId: FAMILY, token: 'fcm-token-own', uid: ADMIN }
      const id = tokenId(base.token)
      await assertSucceeds(setDoc(doc(asAdmin(ADMIN, FAMILY), 'fcmTokens', id), base))
      // Another family cannot overwrite the document, nor move it to theirs.
      await assertFails(
        setDoc(doc(asViewer(OTHER_VIEWER, OTHER_FAMILY), 'fcmTokens', id), {
          familyId: OTHER_FAMILY, token: base.token, uid: OTHER_VIEWER,
        }),
      )
      await assertFails(
        setDoc(doc(asAdmin(ADMIN, FAMILY), 'fcmTokens', id), { ...base, familyId: OTHER_FAMILY }),
      )
      // The owner may refresh it.
      await assertSucceeds(setDoc(doc(asAdmin(ADMIN, FAMILY), 'fcmTokens', id), { ...base, lang: 'en' }))
    })

    it('are deleted by their own family on logout', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'fcmTokens', 'token-hash-bye'), {
          familyId: FAMILY,
          token: 'fcm-token-bye',
        })
      })
      await assertFails(
        deleteDoc(doc(asViewer(OTHER_VIEWER, OTHER_FAMILY), 'fcmTokens', 'token-hash-bye')),
      )
      await assertSucceeds(
        deleteDoc(doc(asViewer(VIEWER, FAMILY), 'fcmTokens', 'token-hash-bye')),
      )
    })
  })

  // ── 6. Invites ────────────────────────────────────────────────────────────

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

  // ── 7. Who the admins are ─────────────────────────────────────────────────
  //
  // Joining with an invite and removing an admin are transactions of
  // functions/membership.js (membership.test.js, membershipRules.test.js).
  // The browser used to make these writes itself, and the rules had to tell a
  // real redemption from a replayed one. Now no write from a client changes
  // who the admins are, so every shape those writes ever had is refused here.

  describe('the admin list', () => {
    const NEWBIE = 'uid-newbie'
    const TOKEN = 'invite-token-1'
    const GONE = 'uid-gone'

    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'families', FAMILY), { adminUids: [ADMIN, GONE] })
        await setDoc(doc(ctx.firestore(), 'families', FAMILY, 'admins', GONE), { viaInvite: 'x' })
      })
    })

    /** What the invite page used to write, as one batch. */
    const redeem = (db, extra = {}) => {
      const batch = writeBatch(db)
      batch.update(doc(db, 'families', FAMILY, 'invites', TOKEN), { used: true, redeemedBy: NEWBIE })
      batch.set(doc(db, 'families', FAMILY, 'admins', NEWBIE), { viaInvite: TOKEN })
      batch.update(doc(db, 'families', FAMILY), { adminUids: arrayUnion(NEWBIE), ...extra })
      return batch.commit()
    }

    it('cannot be joined from the browser, as a batch or in separate writes', async () => {
      const db = asNewAccount(NEWBIE)
      await assertFails(redeem(db))
      await assertFails(
        updateDoc(doc(db, 'families', FAMILY, 'invites', TOKEN), { used: true, redeemedBy: NEWBIE }),
      )
      await assertFails(setDoc(doc(db, 'families', FAMILY, 'admins', NEWBIE), { viaInvite: TOKEN }))
      await assertFails(updateDoc(doc(db, 'families', FAMILY), { adminUids: arrayUnion(NEWBIE) }))
    })

    it('cannot be extended by an admin either', async () => {
      const admin = asAdmin(ADMIN, FAMILY)
      await assertFails(updateDoc(doc(admin, 'families', FAMILY), { adminUids: arrayUnion(NEWBIE) }))
      await assertFails(setDoc(doc(admin, 'families', FAMILY, 'admins', NEWBIE), { viaInvite: TOKEN }))
    })

    it('cannot be shortened from the browser, by the owner or by the one leaving', async () => {
      for (const db of [asAdmin(ADMIN, FAMILY), asAdmin(GONE, FAMILY)]) {
        const family = doc(db, 'families', FAMILY)
        await assertFails(updateDoc(family, { adminUids: arrayRemove(GONE), inviteEpoch: increment(1) }))
        await assertFails(updateDoc(family, { adminUids: arrayRemove(GONE) }))
        await assertFails(updateDoc(family, { adminUids: [ADMIN] }))
        await assertFails(deleteDoc(doc(db, 'families', FAMILY, 'admins', GONE)))
      }
    })

    it('leaves the invite epoch to the removal that raises it', async () => {
      const family = doc(asAdmin(ADMIN, FAMILY), 'families', FAMILY)
      await assertFails(updateDoc(family, { inviteEpoch: increment(1) }))
      await assertFails(updateDoc(family, { familyName: 'X', inviteEpoch: 5 }))
      await assertSucceeds(updateDoc(family, { familyName: 'X' }))
    })

    it('still shows the admins to an admin, and to nobody else', async () => {
      await assertSucceeds(getDocs(collection(asAdmin(ADMIN, FAMILY), 'families', FAMILY, 'admins')))
      await assertFails(getDocs(collection(asViewer(VIEWER, FAMILY), 'families', FAMILY, 'admins')))
      await assertFails(getDocs(collection(asAdmin(OUTSIDER, FAMILY), 'families', FAMILY, 'admins')))
    })
  })

  describe('minting invites', () => {
    const dayAhead = () => Timestamp.fromDate(new Date(Date.now() + 86_400_000))
    const inviteData = (extra = {}) => ({
      createdBy: ADMIN,
      used: false,
      redeemedBy: null,
      expiresAt: dayAhead(),
      ...extra,
    })

    it('is for the family\'s current epoch and no other', async () => {
      const admin = asAdmin(ADMIN, FAMILY)
      await assertFails(setDoc(doc(admin, 'families', FAMILY, 'invites', INVITE_ID + 'f'), inviteData({ epoch: 1 })))
      // What a removal does, through the Admin SDK.
      await testEnv.withSecurityRulesDisabled((ctx) =>
        updateDoc(doc(ctx.firestore(), 'families', FAMILY), { inviteEpoch: 1 }),
      )
      await assertFails(setDoc(doc(admin, 'families', FAMILY, 'invites', INVITE_ID + 'p'), inviteData({ epoch: 0 })))
      await assertFails(setDoc(doc(admin, 'families', FAMILY, 'invites', INVITE_ID + 'u'), inviteData()))
      await assertSucceeds(setDoc(doc(admin, 'families', FAMILY, 'invites', INVITE_ID + 'c'), inviteData({ epoch: 1 })))
    })

    it('can be taken back by an admin', async () => {
      await assertSucceeds(deleteDoc(doc(asAdmin(ADMIN, FAMILY), 'families', FAMILY, 'invites', 'invite-token-1')))
    })

    it('cannot be minted or listed on a claim the family document no longer backs', async () => {
      // A removed admin keeps their claim in the ID token they hold for up to
      // an hour. Minting or listing invites would turn that into a way back in.
      const stale = asAdmin('uid-removed', FAMILY)
      await assertFails(
        setDoc(doc(stale, 'families', FAMILY, 'invites', INVITE_ID), {
          createdBy: 'uid-removed',
          used: false,
          redeemedBy: null,
          expiresAt: Timestamp.fromDate(new Date(Date.now() + 86_400_000)),
        }),
      )
      await assertFails(getDocs(collection(stale, 'families', FAMILY, 'invites')))
    })

    it('needs an id as long and random-looking as the client\'s tokens', async () => {
      const admin = asAdmin(ADMIN, FAMILY)
      const mint = (id) => setDoc(doc(admin, 'families', FAMILY, 'invites', id), inviteData({ epoch: 0 }))
      // The backdoor an admin session could leave behind: an id anyone can guess.
      await assertFails(mint('a'))
      await assertFails(mint('A'.repeat(31)))
      await assertFails(mint('A'.repeat(31) + '.'))
      await assertFails(mint('A'.repeat(200)))
      await assertSucceeds(mint('A'.repeat(32)))
    })

    it('cannot outlive the week or two the client asks for', async () => {
      const admin = asAdmin(ADMIN, FAMILY)
      const days = (n) => Timestamp.fromDate(new Date(Date.now() + n * 86_400_000))
      const mint = (suffix, expiresAt) =>
        setDoc(doc(admin, 'families', FAMILY, 'invites', INVITE_ID + suffix), inviteData({ epoch: 0, expiresAt }))
      await assertFails(mint('a', days(365_000)))
      await assertFails(mint('b', days(15)))
      await assertFails(mint('c', days(-1)))
      await assertSucceeds(mint('d', days(7)))
    })

    it('carries the fields the client writes and no others', async () => {
      const admin = asAdmin(ADMIN, FAMILY)
      const ref = doc(admin, 'families', FAMILY, 'invites', INVITE_ID)
      await assertFails(setDoc(ref, inviteData({ epoch: 0, role: 'owner' })))
      await assertSucceeds(
        setDoc(ref, inviteData({ epoch: 0, createdAt: new Date(), redeemedAt: null })),
      )
    })

    it('can still be minted by a current admin', async () => {
      await assertSucceeds(
        setDoc(doc(asAdmin(ADMIN, FAMILY), 'families', FAMILY, 'invites', INVITE_ID), {
          createdBy: ADMIN,
          used: false,
          redeemedBy: null,
          expiresAt: Timestamp.fromDate(new Date(Date.now() + 86_400_000)),
        }),
      )
    })
  })

  // ── 8. Crossing families ──────────────────────────────────────────────────
  //
  // Anyone can become the admin of *a* family by signing up. An update that
  // could change familyId would let them write into any other family's space.

  describe('an admin of another family', () => {
    const COLLECTIONS = [
      'memories', 'moments', 'albums', 'children', 'journals',
      'scrapbooks', 'collages', 'highlights',
    ]

    it.each(COLLECTIONS)('cannot move a %s document into this family', async (name) => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), name, 'theirs'), { familyId: OTHER_FAMILY, title: sealed('x') })
      })
      const db = asAdmin('uid-admin-2', OTHER_FAMILY)
      await assertSucceeds(updateDoc(doc(db, name, 'theirs'), { title: sealed('still theirs') }))
      await assertFails(updateDoc(doc(db, name, 'theirs'), { familyId: FAMILY, title: sealed('Injected') }))
    })
  })

  // ── 8b. A confirmed email address ─────────────────────────────────────────
  //
  // A password reset goes to the address an account was registered with. An
  // account whose address nobody confirmed — a typo, someone else's address —
  // belongs to whoever reads that mailbox, so it must not become an admin.

  describe('an account whose email address is not confirmed', () => {
    const KEY = { k: 'the-secret-key', kty: 'oct' }
    const newFamily = (db) => setDoc(doc(db, 'families', 'family-new'), {
      adminUid: 'uid-new-owner',
      adminUids: ['uid-new-owner'],
      familyName: 'The Newcomers',
      familySlug: 'the-newcomers',
      encryptionKeyJwk: KEY,
    })

    it('cannot found a family', async () => {
      await assertFails(newFamily(asNewAccount('uid-new-owner', { verified: false })))
      await assertFails(newFamily(asClaimlessAdmin('uid-new-owner')))
    })

    it('can, once the address is confirmed', async () => {
      await assertSucceeds(newFamily(asNewAccount('uid-new-owner')))
    })

    it('does not lock out an admin from before the check', async () => {
      const db = asNewAccount(ADMIN, { verified: false })
      await assertSucceeds(getDoc(doc(db, 'families', FAMILY)))
      await assertSucceeds(updateDoc(doc(db, 'families', FAMILY), { familyName: 'Still ours' }))
      await assertSucceeds(
        setDoc(doc(db, 'memories', 'mem-unverified'), { familyId: FAMILY, title: CIPHERTEXT }),
      )
    })
  })

  // ── 9. The encryption key ─────────────────────────────────────────────────
  //
  // The family's content is encrypted with it, so replacing or removing it
  // leaves all of that unreadable for everyone. Any admin could, on any of the
  // update paths, and so could a bug or two devices racing.

  describe('the encryption key', () => {
    const KEY = { k: 'the-secret-key', kty: 'oct' }
    const family = (db, id = FAMILY) => doc(db, 'families', id)

    it('stays put while an admin edits the family', async () => {
      const db = asAdmin(ADMIN, FAMILY)
      await assertSucceeds(updateDoc(family(db), { familyName: 'The Miller Family' }))
      await assertSucceeds(setDoc(family(db), { loginPageMode: 'classic' }, { merge: true }))
      // Writing back the key the family already has changes nothing.
      await assertSucceeds(updateDoc(family(db), { encryptionKeyJwk: KEY }))
    })

    it('cannot be replaced', async () => {
      await assertFails(updateDoc(family(asAdmin(ADMIN, FAMILY)), {
        encryptionKeyJwk: { k: 'a-new-key', kty: 'oct' },
      }))
    })

    it('cannot be removed, as a field or by rewriting the document without it', async () => {
      const db = asAdmin(ADMIN, FAMILY)
      await assertFails(updateDoc(family(db), { encryptionKeyJwk: deleteField() }))
      await assertFails(setDoc(family(db), {
        adminUid: ADMIN,
        adminUids: [ADMIN],
        familyName: 'The Millers',
        familySlug: 'the-millers',
      }))
    })

    it('cannot ride along with a change to the admins', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(family(ctx.firestore()), { adminUids: [ADMIN, 'uid-admin-b'] })
      })
      const db = asAdmin(ADMIN, FAMILY)
      const newKey = { k: 'a-new-key', kty: 'oct' }
      // What removing an admin used to look like, from the browser.
      await assertFails(updateDoc(family(db), {
        adminUids: [ADMIN],
        inviteEpoch: increment(1),
        encryptionKeyJwk: newKey,
      }))
    })

    it('is not handed to a family from before encryption', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(family(ctx.firestore(), 'family-plain'), {
          adminUid: ADMIN,
          adminUids: [ADMIN],
          familyName: 'The Plains',
        })
      })
      await assertFails(updateDoc(family(asAdmin(ADMIN, 'family-plain'), 'family-plain'), { encryptionKeyJwk: KEY }))
    })

    it('is still written with a new family', async () => {
      await assertSucceeds(setDoc(family(asNewAccount('uid-new-owner'), 'family-new'), {
        adminUid: 'uid-new-owner',
        adminUids: ['uid-new-owner'],
        familyName: 'The Newcomers',
        familySlug: 'the-newcomers',
        encryptionKeyJwk: KEY,
      }))
    })

    it('comes with a family that names its admins, and no other kind', async () => {
      // adminUids is what every rule reads; a family without it is the shape
      // from before it, which nothing migrates any more.
      await assertFails(setDoc(family(asNewAccount('uid-new-owner'), 'family-new'), {
        adminUid: 'uid-new-owner',
        familyName: 'The Newcomers',
        familySlug: 'the-newcomers',
        encryptionKeyJwk: KEY,
      }))
    })

    it('cannot be given admins by the owner field alone', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(family(ctx.firestore(), 'family-old'), { adminUid: 'uid-old-owner', encryptionKeyJwk: KEY })
      })
      const owner = asClaimlessAdmin('uid-old-owner')
      await assertFails(getDoc(family(owner, 'family-old')))
      await assertFails(updateDoc(family(owner, 'family-old'), { adminUids: ['uid-old-owner'] }))
    })

    it('must come with a new family', async () => {
      const db = asNewAccount('uid-new-owner')
      const newFamily = (encryptionKeyJwk) => setDoc(family(db, 'family-new'), {
        adminUid: 'uid-new-owner',
        adminUids: ['uid-new-owner'],
        familyName: 'The Newcomers',
        familySlug: 'the-newcomers',
        ...(encryptionKeyJwk === undefined ? {} : { encryptionKeyJwk }),
      })
      await assertFails(newFamily(undefined))
      await assertFails(newFamily(null))
      await assertFails(newFamily('the-secret-key'))
      await assertFails(newFamily({ kty: 'oct' }))
      await assertFails(newFamily({ k: 'the-secret-key', kty: 'RSA' }))
      await assertSucceeds(newFamily(KEY))
    })
  })

  // ── 8. Viewer sessions end with the shared password ────────────────────────

  describe('viewer session version', () => {
    const asVersionedViewer = (sv) => {
      const claims = { familyId: FAMILY, role: 'viewer' }
      if (sv !== undefined) claims.sv = sv
      return testEnv.authenticatedContext(VIEWER, claims).firestore()
    }
    const setVersion = (version) =>
      testEnv.withSecurityRulesDisabled((ctx) =>
        updateDoc(doc(ctx.firestore(), 'families', FAMILY), { viewerSessionVersion: version }),
      )
    const feed = (db) =>
      getDocs(query(collection(db, 'memories'), where('familyId', '==', FAMILY)))

    it('lets a token whose sv matches the family version read', async () => {
      await setVersion(2)
      await assertSucceeds(getDoc(doc(asVersionedViewer(2), 'families', FAMILY)))
      await assertSucceeds(feed(asVersionedViewer(2)))
    })

    it('denies a token issued before the version was raised', async () => {
      await setVersion(1)
      await assertFails(getDoc(doc(asVersionedViewer(0), 'families', FAMILY)))
      await assertFails(feed(asVersionedViewer(0)))
      await assertFails(getDoc(doc(asVersionedViewer(undefined), 'families', FAMILY)))
    })

    it('lets a token without sv read while the family has no version', async () => {
      await assertSucceeds(getDoc(doc(asVersionedViewer(undefined), 'families', FAMILY)))
      await assertSucceeds(feed(asVersionedViewer(undefined)))
    })

    it('denies a token without sv once the version is 1', async () => {
      await setVersion(1)
      await assertFails(feed(asVersionedViewer(undefined)))
    })

    it('denies a token from the future version', async () => {
      await assertFails(getDoc(doc(asVersionedViewer(1), 'families', FAMILY)))
    })

    it('does not let an admin change or reset the version', async () => {
      const admin = asAdmin(ADMIN, FAMILY)
      await assertFails(updateDoc(doc(admin, 'families', FAMILY), { viewerSessionVersion: 5 }))
      await setVersion(3)
      await assertFails(updateDoc(doc(admin, 'families', FAMILY), { viewerSessionVersion: 0 }))
      await assertFails(updateDoc(doc(admin, 'families', FAMILY), { viewerSessionVersion: deleteField() }))
      await assertSucceeds(updateDoc(doc(admin, 'families', FAMILY), { familyName: 'The Millers II' }))
    })
  })
})

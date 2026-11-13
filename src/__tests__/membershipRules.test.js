/**
 * Joining and leaving a family, against the emulator.
 *
 * functions/membership.js makes these changes in transactions through the
 * Admin SDK; membership.test.js covers its decisions with a stand-in for
 * Firestore. Here the same code runs on the real thing, and the rules are
 * asked what each change means for the people involved: a redeemer reads the
 * family and its key the moment they are in, and a removed admin reads
 * nothing the moment they are out — with a token that still calls them admin.
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
import { collection, doc, getDoc, getDocs, setDoc, Timestamp } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { initializeApp, deleteApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { redeemInvite, removeAdmin } from '../../functions/membership.js'

// Set by `firebase emulators:exec`; absent during a plain `npm test`.
const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

const FAMILY = 'family-1'
const OWNER = 'uid-owner'
const NEWBIE = 'uid-newbie'
const TOKEN = 'invite-token-1'
// Ids of invites minted through the rules, which insist on a token-sized one.
const KEPT = 'kept'.padEnd(43, 'k')
const OLD_EPOCH = 'old-epoch'.padEnd(43, 'o')
const NEW_EPOCH = 'new-epoch'.padEnd(43, 'n')
const DAY = 24 * 60 * 60 * 1000

let testEnv
let adminApp
let adminDb

const as = (uid, claims = {}) => testEnv.authenticatedContext(uid, claims).firestore()
const newbie = { uid: NEWBIE, email: 'new@example.test', emailVerified: true }
const redeem = (token = TOKEN) => redeemInvite({ db: adminDb }, newbie, { familyId: FAMILY, token })
const adminUids = async () => (await adminDb.doc(`families/${FAMILY}`).get()).data().adminUids

describe.skipIf(!EMULATOR)('joining and leaving a family', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-kaydo-membership-rules',
      firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    })
    adminApp = initializeApp({ projectId: 'demo-kaydo-membership-rules' }, 'membership-rules')
    adminDb = getFirestore(adminApp)
  })

  afterAll(async () => {
    await testEnv?.cleanup()
    if (adminApp) await deleteApp(adminApp)
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'families', FAMILY), {
        adminUid: OWNER,
        adminUids: [OWNER],
        familyName: 'The Millers',
        encryptionKeyJwk: { k: 'the-secret-key', kty: 'oct' },
      })
      await setDoc(doc(db, 'families', FAMILY, 'invites', TOKEN), {
        createdBy: OWNER,
        used: false,
        redeemedBy: null,
        epoch: 0,
        expiresAt: Timestamp.fromMillis(Date.now() + DAY),
      })
    })
  })

  it('lets the redeemer in at once, before any claim has arrived', async () => {
    await assertFails(getDoc(doc(as(NEWBIE), 'families', FAMILY)))
    await redeem()
    const family = await assertSucceeds(getDoc(doc(as(NEWBIE), 'families', FAMILY)))
    expect(family.data().encryptionKeyJwk.k).toBe('the-secret-key')
    await assertSucceeds(getDocs(collection(as(NEWBIE), 'families', FAMILY, 'admins')))
    expect(await adminUids()).toEqual([OWNER, NEWBIE])
  })

  it('spends the invite for good, also for two redeemers at once', async () => {
    const other = { uid: 'uid-other', email: 'other@example.test', emailVerified: true }
    const results = await Promise.allSettled([
      redeem(),
      redeemInvite({ db: adminDb }, other, { familyId: FAMILY, token: TOKEN }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await adminUids()).toHaveLength(2)
    await expect(redeem()).rejects.toMatchObject({ code: 'failed-precondition' })
  })

  it('shuts a removed admin out at once, whatever their token still says', async () => {
    await redeem()
    // A second link, minted while they were in: they could have copied it.
    await assertSucceeds(setDoc(doc(as(OWNER), 'families', FAMILY, 'invites', KEPT), {
      createdBy: OWNER,
      used: false,
      redeemedBy: null,
      epoch: 0,
      expiresAt: Timestamp.fromMillis(Date.now() + DAY),
    }))

    await removeAdmin({ db: adminDb }, OWNER, { familyId: FAMILY, uid: NEWBIE })

    expect(await adminUids()).toEqual([OWNER])
    const stale = as(NEWBIE, { familyId: FAMILY, role: 'admin' })
    await assertFails(getDoc(doc(stale, 'families', FAMILY)))
    await assertFails(getDocs(collection(stale, 'families', FAMILY, 'invites')))
    // The pending link went with them, and their own spent one is no way back.
    expect((await adminDb.doc(`families/${FAMILY}/invites/${KEPT}`).get()).exists).toBe(false)
    expect((await adminDb.doc(`families/${FAMILY}/admins/${NEWBIE}`).get()).exists).toBe(false)
    await expect(redeem()).rejects.toMatchObject({ code: 'failed-precondition' })
    await expect(redeem(KEPT)).rejects.toMatchObject({ code: 'failed-precondition' })
  })

  it('lets an invite minted after a removal work, and one from before it not', async () => {
    await redeem()
    await removeAdmin({ db: adminDb }, OWNER, { familyId: FAMILY, uid: NEWBIE })
    const invite = (epoch) => ({
      createdBy: OWNER,
      used: false,
      redeemedBy: null,
      epoch,
      expiresAt: Timestamp.fromMillis(Date.now() + DAY),
    })
    // The rules let an admin mint only for the epoch the removal left.
    await assertFails(setDoc(doc(as(OWNER), 'families', FAMILY, 'invites', OLD_EPOCH), invite(0)))
    await assertSucceeds(setDoc(doc(as(OWNER), 'families', FAMILY, 'invites', NEW_EPOCH), invite(1)))
    await redeem(NEW_EPOCH)
    expect(await adminUids()).toEqual([OWNER, NEWBIE])
  })

  it('keeps the owner, whoever asks', async () => {
    await redeem()
    await expect(removeAdmin({ db: adminDb }, NEWBIE, { familyId: FAMILY, uid: OWNER })).rejects.toMatchObject({ code: 'failed-precondition' })
    expect(await adminUids()).toEqual([OWNER, NEWBIE])
  })
})

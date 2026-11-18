/**
 * Security-rule tests for the text of moments, and the run that encrypts the
 * moments from before it was encrypted (src/services/momentEncryption.js).
 *
 * A moment written now is marked (`textEncrypted`) and holds ciphertext; one
 * from before holds its text in clear until an admin's browser encrypts it.
 * The rules have to refuse a new moment in clear, and must never let an
 * encrypted one fall back, while still letting the old ones be edited and
 * encrypted.
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { addDoc, collection, doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { webcrypto } from 'node:crypto'
import { sealed } from './fakeCiphertext'
import { decryptText, generateEncryptionKey } from '../utils/encryption'
import { encryptFamilyMoments } from '../services/momentEncryption'

const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

const FAMILY = 'family-1'
const ADMIN = 'uid-admin'
const VIEWER = `viewer:${FAMILY}`

let testEnv

const asAdmin = () => testEnv.authenticatedContext(ADMIN).firestore()
const asViewer = () => testEnv.authenticatedContext(VIEWER, { familyId: FAMILY, role: 'viewer' }).firestore()

const encryptedText = {
  caption: sealed('caption'),
  location: sealed('location'),
  category: sealed('category'),
  label: sealed('label'),
  textEncrypted: true,
}

const inClear = {
  caption: 'Picnic at the lake',
  location: 'Lake Tegernsee',
  category: 'Family',
  label: '',
}

const moment = (text) => ({ ...text, familyId: FAMILY, images: ['a.enc'], videos: [], date: Timestamp.now() })

describe.skipIf(!EMULATOR)('Moment text rules', () => {
  beforeAll(async () => {
    if (!globalThis.crypto?.subtle) {
      Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
    }
    const [host, port] = EMULATOR.split(':')
    testEnv = await initializeTestEnvironment({
      // Its own project id: clearFirestore() wipes a whole project, and vitest
      // runs the rules suites in parallel.
      projectId: 'demo-kaydo-moment-text-rules',
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
      await setDoc(doc(db, 'families', FAMILY), { adminUid: ADMIN, adminUids: [ADMIN], familyName: 'Test' })
      await setDoc(doc(db, 'moments', 'old'), moment(inClear))
      await setDoc(doc(db, 'moments', 'new'), moment(encryptedText))
    })
  })

  describe('a new moment', () => {
    it('is written encrypted and marked', async () => {
      await assertSucceeds(addDoc(collection(asAdmin(), 'moments'), moment(encryptedText)))
    })

    it('is refused in clear, as an app from before the change writes it', async () => {
      await assertFails(addDoc(collection(asAdmin(), 'moments'), moment(inClear)))
    })

    it('is refused when marked but in clear', async () => {
      await assertFails(addDoc(collection(asAdmin(), 'moments'), moment({ ...inClear, textEncrypted: true })))
      await assertFails(addDoc(collection(asAdmin(), 'moments'), moment({ ...encryptedText, location: 'Lake Tegernsee' })))
    })

    it('is still refused to a viewer', async () => {
      await assertFails(addDoc(collection(asViewer(), 'moments'), moment(encryptedText)))
    })
  })

  describe('an encrypted moment', () => {
    it('takes new ciphertext and changes to its other fields', async () => {
      await assertSucceeds(updateDoc(doc(asAdmin(), 'moments', 'new'), { ...encryptedText, caption: sealed('edited') }))
      await assertSucceeds(updateDoc(doc(asAdmin(), 'moments', 'new'), { images: ['a.enc', 'b.enc'] }))
    })

    it('takes no text in clear', async () => {
      await assertFails(updateDoc(doc(asAdmin(), 'moments', 'new'), { caption: 'Picnic at the lake' }))
    })

    it('keeps its mark', async () => {
      await assertFails(updateDoc(doc(asAdmin(), 'moments', 'new'), { ...inClear, textEncrypted: false }))
      await assertFails(updateDoc(doc(asAdmin(), 'moments', 'new'), { ...inClear, textEncrypted: null }))
    })
  })

  describe('a moment from before', () => {
    it('can still be edited in clear by an app loaded before the change', async () => {
      await assertSucceeds(updateDoc(doc(asAdmin(), 'moments', 'old'), { caption: 'Picnic, later' }))
    })

    it('can be encrypted as a whole', async () => {
      await assertSucceeds(updateDoc(doc(asAdmin(), 'moments', 'old'), encryptedText))
    })

    it('cannot be marked while part of its text is still in clear', async () => {
      await assertFails(updateDoc(doc(asAdmin(), 'moments', 'old'), { caption: sealed('caption'), textEncrypted: true }))
    })
  })

  describe('encryptFamilyMoments', () => {
    it('encrypts the moments in clear, through the rules, and leaves the rest', async () => {
      const { key } = await generateEncryptionKey()
      const before = (await getDoc(doc(asAdmin(), 'moments', 'new'))).data()

      const stats = await encryptFamilyMoments(FAMILY, key, { database: asAdmin() })
      expect(stats).toEqual({ encrypted: 1, failed: 0 })

      const old = (await getDoc(doc(asAdmin(), 'moments', 'old'))).data()
      expect(old.textEncrypted).toBe(true)
      expect(old.caption).not.toBe(inClear.caption)
      expect(await decryptText(key, old.caption)).toBe(inClear.caption)
      expect(await decryptText(key, old.location)).toBe(inClear.location)
      expect(await decryptText(key, old.category)).toBe(inClear.category)
      expect(await decryptText(key, old.label)).toBe('')
      // Only the text and the mark change.
      expect(old.images).toEqual(['a.enc'])
      expect((await getDoc(doc(asAdmin(), 'moments', 'new'))).data()).toEqual(before)

      // Nothing left to do: the counts say so, and nothing is read or written.
      expect(await encryptFamilyMoments(FAMILY, key, { database: asAdmin() })).toEqual({ encrypted: 0, failed: 0 })
    })

    it('cannot write for a viewer, and leaves the moment readable', async () => {
      const { key } = await generateEncryptionKey()
      const stats = await encryptFamilyMoments(FAMILY, key, { database: asViewer() })
      expect(stats).toEqual({ encrypted: 0, failed: 1 })
      const old = (await getDoc(doc(asAdmin(), 'moments', 'old'))).data()
      expect(old.caption).toBe(inClear.caption)
      expect(old.textEncrypted).toBeUndefined()
    })
  })
})

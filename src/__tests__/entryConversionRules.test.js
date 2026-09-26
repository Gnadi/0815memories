/**
 * Security-rule tests for converting between memories and moments: one batch
 * that creates the entry in the other collection and deletes the original.
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
import { doc, setDoc, collection, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore'
import { readFileSync } from 'node:fs'

const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

const FAMILY = 'family-1'
const ADMIN = 'uid-admin'
const VIEWER = 'uid-viewer'
const CIPHERTEXT = 'kJ8xQ2hZbGxvV29ybGRUaGlzSXNCYXNlNjQ='

let testEnv

describe.skipIf(!EMULATOR)('Memory / moment conversion rules', () => {
  beforeAll(async () => {
    const [host, port] = EMULATOR.split(':')
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-kaydo-conversion-rules',
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
      await setDoc(doc(db, 'moments', 'moment-1'), {
        familyId: FAMILY,
        caption: 'Picnic',
        images: ['a.enc'],
        videos: [],
        date: Timestamp.now(),
      })
      await setDoc(doc(db, 'memories', 'memory-1'), {
        familyId: FAMILY,
        title: CIPHERTEXT,
        content: CIPHERTEXT,
        contentRich: CIPHERTEXT,
        date: Timestamp.now(),
      })
    })
  })

  const convertMomentToMemory = (db) => {
    const batch = writeBatch(db)
    batch.set(doc(collection(db, 'memories')), {
      title: CIPHERTEXT,
      content: CIPHERTEXT,
      contentRich: CIPHERTEXT,
      quote: '',
      category: '',
      location: '',
      authorName: '',
      featured: false,
      polaroidBorder: { style: 'classic' },
      images: ['a.enc'],
      imageUrl: 'a.enc',
      voiceMemos: [],
      videos: [],
      date: Timestamp.now(),
      familyId: FAMILY,
      createdByUid: ADMIN,
      createdAt: serverTimestamp(),
    })
    batch.delete(doc(db, 'moments', 'moment-1'))
    return batch.commit()
  }

  const convertMemoryToMoment = (db) => {
    const batch = writeBatch(db)
    batch.set(doc(collection(db, 'moments')), {
      caption: 'Beach day',
      category: '',
      location: '',
      label: '',
      images: ['a.enc'],
      videos: [],
      familyId: FAMILY,
      createdByUid: ADMIN,
      date: Timestamp.now(),
    })
    batch.delete(doc(db, 'memories', 'memory-1'))
    return batch.commit()
  }

  it('an admin can turn a moment into a memory', async () => {
    await assertSucceeds(convertMomentToMemory(testEnv.authenticatedContext(ADMIN).firestore()))
  })

  it('an admin can turn a memory into a moment', async () => {
    await assertSucceeds(convertMemoryToMoment(testEnv.authenticatedContext(ADMIN).firestore()))
  })

  it('a non-admin cannot convert', async () => {
    await assertFails(convertMomentToMemory(testEnv.authenticatedContext(VIEWER).firestore()))
  })
})

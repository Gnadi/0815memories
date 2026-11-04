// @vitest-environment node
/**
 * Every encrypted field holds ciphertext, or the write is refused.
 *
 * Family content is stored as the client wrote it, so the rules are the only
 * place that can notice a field the client forgot to encrypt — the Black Box
 * stored its letters readable for the life of the feature that way, and
 * nothing said so. `isCiphertext()` in firestore.rules accepts what
 * encryptText() writes and nothing that reads as text.
 *
 * The field lists mirror the services in src/services/ (and the seed,
 * scripts/seed-emulator.mjs). A field encrypted there and missing here is one
 * the rules would let through in plaintext.
 *
 * Run with:  npm run test:rules
 * (Skipped by default — `npm test` stays emulator-free.)
 */
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { deleteField, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import { readFileSync } from 'node:fs'
import { encryptJSON, encryptText, generateEncryptionKey } from '../utils/encryption'

const EMULATOR = globalThis.process?.env?.FIRESTORE_EMULATOR_HOST

const FAMILY = 'family-1'
const ADMIN = 'uid-admin'
const PARTNER = 'uid-partner'

const future = () => new Date(Date.now() + 365 * 24 * 3600 * 1000)

// What a document of each collection needs besides its encrypted fields, and
// which of its fields are encrypted.
const COLLECTIONS = {
  memories: { base: () => ({ familyId: FAMILY }), fields: ['title', 'content', 'quote', 'location', 'authorName', 'category', 'contentRich'] },
  children: { base: () => ({ familyId: FAMILY }), fields: ['name', 'birthTime', 'birthPlace'] },
  journals: { base: () => ({ familyId: FAMILY }), fields: ['content', 'contentRich'] },
  recipes: {
    base: () => ({ familyId: FAMILY }),
    fields: ['title', 'description', 'instructions', 'instructionsRich', 'chefNote', 'forkReason', 'author', 'ingredients'],
  },
  scrapbooks: { base: () => ({ familyId: FAMILY }), fields: ['title', 'pages'] },
  collages: { base: () => ({ familyId: FAMILY }), fields: ['title', 'doc'] },
  highlights: { base: () => ({ familyId: FAMILY }), fields: ['title', 'doc'] },
  blackbox: { base: () => ({ familyId: FAMILY, unlockDate: future() }), fields: ['title'] },
  ourYearRituals: { base: () => ({ familyId: FAMILY, participantUids: [ADMIN, PARTNER] }), fields: ['occasionLabel', 'partners'] },
  ourYearChapters: {
    base: () => ({ familyId: FAMILY, participantUids: [ADMIN, PARTNER] }),
    fields: ['title', 'quizQuestions', 'quizReactions', 'keepsakes'],
  },
  ourYearEntries: { base: () => ({ familyId: FAMILY, participantUids: [ADMIN, PARTNER], authorUid: ADMIN }), fields: ['answers'] },
  ourYearLetters: { base: () => ({ familyId: FAMILY, participantUids: [ADMIN, PARTNER] }), fields: ['sections'] },
}

// Ways a field goes out unencrypted, each of which the rules must refuse.
const PLAINTEXT = {
  'a short text': 'Sommer',
  'a sentence': 'Der Sommer bei Oma am See, als alle noch da waren',
  'unencrypted JSON': JSON.stringify([{ name: 'Mehl', amount: '500 g' }]),
  'an empty string': '',
  'a number': 42,
  'a map': { text: 'Sommer' },
}

let testEnv
let key
let ciphertext

describe.skipIf(!EMULATOR)('Encrypted fields in the security rules', () => {
  beforeAll(async () => {
    const [host, port] = EMULATOR.split(':')
    testEnv = await initializeTestEnvironment({
      // Its own project id: clearFirestore() wipes a whole project, and vitest
      // runs the rules suites in parallel.
      projectId: 'demo-kaydo-encrypted-fields-rules',
      firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
    })
    ;({ key } = await generateEncryptionKey())
    ciphertext = await encryptText(key, 'Der Sommer bei Oma')
  })

  afterAll(async () => {
    await testEnv?.cleanup()
  })

  beforeEach(async () => {
    await testEnv.clearFirestore()
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'families', FAMILY), {
        adminUid: ADMIN,
        adminUids: [ADMIN, PARTNER],
        familyName: 'One',
      })
    })
  })

  const asAdmin = () => testEnv.authenticatedContext(ADMIN).firestore()

  for (const [collection, { base, fields }] of Object.entries(COLLECTIONS)) {
    describe(collection, () => {
      it('takes every encrypted field as ciphertext', async () => {
        const data = { ...base() }
        for (const field of fields) data[field] = await encryptText(key, field)
        await assertSucceeds(setDoc(doc(asAdmin(), collection, 'whole'), data))
      })

      for (const field of fields) {
        it(`refuses \`${field}\` in plaintext, on create and on update`, async () => {
          for (const [, value] of Object.entries(PLAINTEXT)) {
            await assertFails(setDoc(doc(asAdmin(), collection, 'plain'), { ...base(), [field]: value }))
          }
          await testEnv.withSecurityRulesDisabled(async (context) => {
            await setDoc(doc(context.firestore(), collection, 'existing'), { ...base(), [field]: ciphertext })
          })
          await assertFails(updateDoc(doc(asAdmin(), collection, 'existing'), { [field]: 'Sommer am See' }))
          await assertSucceeds(updateDoc(doc(asAdmin(), collection, 'existing'), { [field]: ciphertext }))
        })
      }
    })
  }

  it('takes encryptJSON output, which is ciphertext like any other', async () => {
    const ingredients = await encryptJSON(key, [{ name: 'Mehl', amount: '500 g' }])
    await assertSucceeds(setDoc(doc(asAdmin(), 'recipes', 'r1'), { familyId: FAMILY, ingredients }))
  })

  it('takes the ciphertext of an empty string, the shortest there is', async () => {
    const empty = await encryptText(key, '')
    await assertSucceeds(setDoc(doc(asAdmin(), 'memories', 'm1'), { familyId: FAMILY, quote: empty }))
  })

  it('checks a large field whole, as it checks a small one', async () => {
    // A scrapbook's pages or a rich description run to hundreds of kilobytes;
    // the alphabet check has to hold there too, not only at the start.
    const big = 'A'.repeat(600000)
    await assertSucceeds(setDoc(doc(asAdmin(), 'scrapbooks', 'big'), { familyId: FAMILY, pages: big }))
    await assertFails(setDoc(doc(asAdmin(), 'scrapbooks', 'big-plain'), { familyId: FAMILY, pages: big + ' ' + 'A'.repeat(3) }))
  })

  it('lets a field be cleared, and a document carry no encrypted field at all', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'children', 'kid'), { familyId: FAMILY, birthTime: ciphertext })
    })
    await assertSucceeds(updateDoc(doc(asAdmin(), 'children', 'kid'), { birthTime: deleteField() }))
    await assertSucceeds(updateDoc(doc(asAdmin(), 'children', 'kid'), { birthPlace: null }))
    await assertSucceeds(setDoc(doc(asAdmin(), 'scrapbooks', 's1'), { familyId: FAMILY, pageCount: 0 }))
  })

  it('refuses a capsule letter in plaintext', async () => {
    const write = (message) => {
      const db = asAdmin()
      const batch = writeBatch(db)
      batch.set(doc(db, 'blackbox', 'box'), { familyId: FAMILY, title: ciphertext, unlockDate: future() })
      batch.set(doc(db, 'blackboxContent', 'box'), { familyId: FAMILY, message })
      return batch.commit()
    }
    await assertFails(write('Liebe Emma, wenn du das liest'))
    await assertSucceeds(write(ciphertext))
  })

  it('refuses a best-of story in plaintext', async () => {
    const bestOf = (story) => ({ familyId: FAMILY, month: '2026-07', version: 1, doc: story })
    await assertFails(setDoc(doc(asAdmin(), 'bestOf', `${FAMILY}_2026-07`), bestOf(JSON.stringify({ slides: [] }))))
    await assertSucceeds(setDoc(doc(asAdmin(), 'bestOf', `${FAMILY}_2026-07`), bestOf(await encryptJSON(key, { slides: [] }))))
  })
})

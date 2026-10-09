/* The demo family is built from words (demo/demoContent.js) and a structure
   that pairs them with dates and pictures by position (demo/demoFamily.js).
   These check that both languages fit that structure, and that the family,
   loaded into the demo database, is in the state the demo promises: this
   week's moments, something "on this day", one capsule open and two sealed,
   and an Our Year chapter waiting for the visitor's answers. */
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { DEMO_CONTENT } from '../demo/demoContent'
import {
  buildDemoFamily,
  DEMO_FAMILY_ID,
  DEMO_VISITOR_UID,
  DEMO_PARTNER_UID,
} from '../demo/demoFamily'
import { createDemoDatabase } from '../demo/demoDatabase'

const DB = { demo: true }
// A Thursday afternoon, far enough from a year's end that nothing wraps.
const NOW = new Date(2026, 9, 8, 15, 30)

// The shape demoFamily.js relies on: every key and every array length — except
// a recipe's own ingredients and changes, which may differ by language.
function shape(value, path = '') {
  if (Array.isArray(value)) {
    if (/\.(ingredients|changes)$/.test(path)) return 'list'
    return value.map((item, i) => shape(item, `${path}[${i}]`))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, shape(value[key], `${path}.${key}`)]))
  }
  // Empty in one language means empty in the other: an empty quote is a
  // memory without a quote, not a missing translation.
  return typeof value === 'string' ? (value ? 'text' : 'empty') : typeof value
}

function load(language = 'en') {
  const { documents, visitor } = buildDemoFamily({ language, now: NOW })
  return { documents, visitor, db: createDemoDatabase({ documents, uid: visitor.uid }) }
}

describe('demo family content', () => {
  it('has the same entries in English and German', () => {
    expect(shape(DEMO_CONTENT.de)).toEqual(shape(DEMO_CONTENT.en))
  })

  it('points only at pictures that exist', () => {
    const { documents } = load()
    const urls = new Set(JSON.stringify(documents).match(/\/demo-media\/[\w-]+\.webp/g))
    expect(urls.size).toBeGreaterThan(10)
    for (const url of urls) {
      expect(existsSync(`public${url}`), url).toBe(true)
    }
  })
})

describe('demo family', () => {
  it('is built in either language, with the visitor as its owner', async () => {
    for (const language of ['en', 'de']) {
      const { db, visitor } = load(language)
      expect(visitor.uid).toBe(DEMO_VISITOR_UID)
      const family = (await db.getDoc(db.doc(DB, 'families', DEMO_FAMILY_ID))).data()
      expect(family.familyName).toBe(DEMO_CONTENT[language].family.name)
      expect(family.adminUids).toEqual([DEMO_VISITOR_UID, DEMO_PARTNER_UID])
      // No key: the app's plaintext mode, which is what lets it show the
      // pictures from public/demo-media/ as they are.
      expect(family.encryptionKeyJwk).toBeUndefined()
    }
  })

  it('has moments from this week and memories from the past only', async () => {
    const { db } = load()
    const family = (name) => db.query(db.collection(DB, name), db.where('familyId', '==', DEMO_FAMILY_ID))
    const moments = (await db.getDocs(family('moments'))).docs.map((d) => d.data().date.toDate())
    expect(moments).toHaveLength(5)
    for (const date of moments) {
      expect(date <= NOW).toBe(true)
      expect(NOW - date).toBeLessThan(7 * 24 * 3600 * 1000)
    }
    const memories = (await db.getDocs(family('memories'))).docs.map((d) => d.data())
    expect(memories.length).toBeGreaterThanOrEqual(8)
    for (const memory of memories) expect(memory.date.toDate() <= NOW).toBe(true)
    expect(memories.filter((m) => m.featured)).toHaveLength(1)
  })

  it('has a memory on this day two years ago', async () => {
    const { db } = load()
    const start = new Date(NOW.getFullYear() - 2, NOW.getMonth(), NOW.getDate())
    const end = new Date(NOW.getFullYear() - 2, NOW.getMonth(), NOW.getDate() + 1)
    const q = db.query(
      db.collection(DB, 'memories'),
      db.where('familyId', '==', DEMO_FAMILY_ID),
      db.where('date', '>=', start),
      db.where('date', '<', end),
    )
    expect((await db.getDocs(q)).size).toBe(1)
  })

  it('keeps all but the first capsule sealed', async () => {
    const { db } = load()
    const content = (id) => db.getDoc(db.doc(DB, 'blackboxContent', id))
    expect((await content('demo-capsule-1')).data().message).toBeTruthy()
    await expect(content('demo-capsule-2')).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(content('demo-capsule-3')).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it("leaves this year's Our Year answers to the visitor", async () => {
    const { db } = load()
    const read = (name, id) => db.getDoc(db.doc(DB, name, id))

    const current = (await read('ourYearChapters', 'demo-chapter-3')).data()
    expect(current.status).toBe('open')
    expect(current.reflectionSubmittedBy).toEqual([DEMO_PARTNER_UID])
    expect(current.periodEnd.toDate() > NOW).toBe(true)
    // The partner's answers wait for the reveal; the visitor has none yet.
    await expect(read('ourYearEntries', `demo-chapter-3_reflection_${DEMO_PARTNER_UID}`))
      .rejects.toMatchObject({ code: 'permission-denied' })
    expect((await read('ourYearEntries', `demo-chapter-3_reflection_${DEMO_VISITOR_UID}`)).exists()).toBe(false)

    // Last year's are revealed, and its letter is sealed until the occasion.
    expect((await read('ourYearEntries', `demo-chapter-2_quiz_${DEMO_PARTNER_UID}`)).data().revealed).toBe(true)
    await expect(read('ourYearLetters', 'demo-chapter-2')).rejects.toMatchObject({ code: 'permission-denied' })
    const sealedUntil = (await read('ourYearChapters', 'demo-chapter-2')).data().letterOpenAt.toDate()
    expect(sealedUntil > NOW).toBe(true)

    // The year before's letter has been opened.
    expect((await read('ourYearLetters', 'demo-chapter-1')).data().sections.now).toBeTruthy()
  })

  it('gives Emma what her birth sky needs', async () => {
    const { db } = load('de')
    const emma = (await db.getDoc(db.doc(DB, 'children', 'demo-emma'))).data()
    expect(emma.birthTime).toMatch(/^\d\d:\d\d$/)
    expect(JSON.parse(emma.birthPlace)).toMatchObject({ name: 'Wien', tz: 'Europe/Vienna' })
  })
})

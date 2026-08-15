/* The export promises "no lock-in" and a full archive, but fetched six
   collections and silently left out scrapbooks, collages, highlights and every
   trace of Our Year. It was visibly half-finished: the decrypt map already had a
   `scrapbooks` entry and a branch for its `pages`, for a collection the fetch
   list never asked for.

   These cover what now comes out, and — just as important — what deliberately
   does not: a capsule or a letter still sealed must not leave through the export
   door that firestore.rules just closed on the console. */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const getDocs = vi.fn()
const getDoc = vi.fn()
const zipFiles = {}

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ name })),
  doc: vi.fn((_db, name, id) => ({ name, id })),
  query: vi.fn((ref, ...c) => ({ ref, c })),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  orderBy: vi.fn(),
  getDocs: (...a) => getDocs(...a),
  getDoc: (...a) => getDoc(...a),
}))
vi.mock('../config/firebase', () => ({ db: {} }))
vi.mock('../hooks/useMemories', () => ({ MEMORY_WRITE_FIELDS: ['title'] }))
vi.mock('../utils/richText', () => ({
  collectRichMediaUrls: () => [],
  parseRichDoc: (v) => v,
}))
// Identity crypto: these tests are about what is collected and written, not
// about the cipher — encryption.test.js covers that.
vi.mock('../utils/encryption', () => ({
  decryptFields: vi.fn(async (_k, obj) => ({ ...obj })),
  decryptJSON: vi.fn(async (_k, v) => (typeof v === 'string' ? JSON.parse(v) : v)),
  decryptBlob: vi.fn(async () => new Blob(['plain'])),
}))
vi.mock('file-saver', () => ({ saveAs: vi.fn() }))

// A JSZip stand-in that records every path written.
vi.mock('jszip', () => {
  class FakeZip {
    folder(name) {
      const prefix = name ? `${name}/` : ''
      return {
        file: (path, content) => { zipFiles[prefix + path] = content },
        folder: (sub) => {
          const p = `${prefix}${sub}/`
          return { file: (path, content) => { zipFiles[p + path] = content } }
        },
      }
    }
    generateAsync = async () => new Blob(['zip'])
  }
  return { default: FakeZip }
})

import { runNasExport } from '../utils/nasExport'

const FAMILY = 'fam1'
const UID = 'uid-a'

function snap(docs) {
  return { docs: docs.map((d) => ({ id: d.id, data: () => d })), empty: docs.length === 0 }
}

/** Answer each collection query by name, in the order runNasExport asks. */
function respond({ collections = {}, capsuleContents = {}, letters = {} } = {}) {
  getDocs.mockImplementation(async (q) => snap(collections[q.ref.name] ?? []))
  getDoc.mockImplementation(async (ref) => {
    if (ref.name === 'families') {
      return { exists: () => true, data: () => ({ familyName: 'Test', encryptionKeyJwk: 'SECRET' }) }
    }
    if (ref.name === 'blackboxContent') {
      const content = capsuleContents[ref.id]
      if (content === 'sealed') throw new Error('permission-denied')
      return { exists: () => content != null, data: () => content }
    }
    if (ref.name === 'ourYearLetters') {
      const letter = letters[ref.id]
      if (letter === 'sealed') throw new Error('permission-denied')
      return { exists: () => letter != null, id: ref.id, data: () => letter }
    }
    return { exists: () => false }
  })
}

async function run() {
  await runNasExport({
    familyId: FAMILY,
    familyName: 'Test',
    uid: UID,
    encryptionKey: { fake: true },
    onProgress: () => {},
  })
}

const json = (path) => JSON.parse(zipFiles[path])
const manifest = () => json(Object.keys(zipFiles).find((k) => k.endsWith('manifest.json')))
const data = (name) => json(Object.keys(zipFiles).find((k) => k.endsWith(`data/${name}`)))

beforeEach(() => {
  vi.clearAllMocks()
  for (const k of Object.keys(zipFiles)) delete zipFiles[k]
})

describe('the collections the export had been leaving behind', () => {
  beforeEach(() => {
    respond({
      collections: {
        scrapbooks: [{ id: 's1', familyId: FAMILY, title: 'Summer', pages: JSON.stringify([
          { elements: [{ type: 'photo', url: 'https://cdn/sb.enc' }, { type: 'text' }] },
        ]) }],
        collages: [{ id: 'c1', familyId: FAMILY, title: 'Trio', doc: JSON.stringify({
          slots: [{ id: 'a', url: 'https://cdn/co.enc' }, { id: 'b', url: null }],
        }) }],
        highlights: [{ id: 'h1', familyId: FAMILY, title: 'Our year', doc: JSON.stringify({
          shots: [{ url: 'https://cdn/sh.enc', thumbUrl: 'https://cdn/thumb.enc' }],
        }) }],
      },
    })
    globalThis.fetch = vi.fn(async () => ({ ok: true, blob: async () => new Blob(['x']) }))
  })

  it('writes a JSON file for each of them', async () => {
    await run()
    expect(data('scrapbooks.json')).toHaveLength(1)
    expect(data('collages.json')).toHaveLength(1)
    expect(data('highlights.json')).toHaveLength(1)
  })

  it('parses their encrypted JSON blobs rather than exporting ciphertext', async () => {
    await run()
    // The scrapbooks branch existed for a collection that was never fetched.
    expect(Array.isArray(data('scrapbooks.json')[0].pages)).toBe(true)
    expect(data('collages.json')[0].doc.slots).toHaveLength(2)
    expect(data('highlights.json')[0].doc.shots).toHaveLength(1)
  })

  it('downloads the photos buried inside those blobs', async () => {
    await run()
    const fetched = globalThis.fetch.mock.calls.map(([url]) => url)
    expect(fetched).toContain('https://cdn/sb.enc')
    expect(fetched).toContain('https://cdn/co.enc')
    expect(fetched).toContain('https://cdn/sh.enc')
  })

  it('skips empty collage slots and highlight thumbnails', async () => {
    await run()
    const fetched = globalThis.fetch.mock.calls.map(([url]) => url)
    // Originals only, as everywhere else in this file.
    expect(fetched).not.toContain('https://cdn/thumb.enc')
    expect(fetched.filter((u) => u === null)).toHaveLength(0)
  })

  it('counts them in the manifest', async () => {
    await run()
    expect(manifest().counts).toMatchObject({ scrapbooks: 1, collages: 1, highlights: 1 })
  })
})

describe('sealed things stay sealed', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, blob: async () => new Blob(['x']) }))
  })

  it('exports an open capsule with its letter', async () => {
    respond({
      collections: { blackbox: [{ id: 'open', familyId: FAMILY, title: 'For Emma' }] },
      capsuleContents: { open: { familyId: FAMILY, message: 'Hello Emma', photos: [] } },
    })
    await run()

    const [capsule] = data('blackbox.json')
    expect(capsule.message).toBe('Hello Emma')
    expect(capsule.sealed).toBe(false)
    // The content document's familyId is not worth repeating in the archive.
    expect(capsule).not.toHaveProperty('familyId', undefined)
  })

  it('exports a sealed capsule as metadata, marked sealed, with no letter', async () => {
    respond({
      collections: { blackbox: [{ id: 'sealed', familyId: FAMILY, title: 'For Emma' }] },
      capsuleContents: { sealed: 'sealed' },
    })
    await run()

    const [capsule] = data('blackbox.json')
    expect(capsule.sealed).toBe(true)
    expect(capsule.message).toBeUndefined()
    // And it is named, so the export does not look like data loss.
    expect(manifest().stillSealed.capsules).toEqual(['sealed'])
  })

  it('leaves a pre-split capsule exactly as it is', async () => {
    respond({
      collections: {
        blackbox: [{ id: 'old', familyId: FAMILY, title: 'T', message: 'inline', photos: [] }],
      },
    })
    await run()

    expect(data('blackbox.json')[0].message).toBe('inline')
    // No content document is looked for when the payload is already there.
    expect(getDoc.mock.calls.filter(([r]) => r.name === 'blackboxContent')).toHaveLength(0)
  })

  it('records a still-sealed Our Year letter without its contents', async () => {
    respond({
      collections: {
        ourYearRituals: [{ id: 'r1', familyId: FAMILY, participantUids: [UID] }],
        ourYearChapters: [{ id: 'ch1', familyId: FAMILY, ritualId: 'r1', participantUids: [UID] }],
        ourYearEntries: [],
      },
      letters: { ch1: 'sealed' },
    })
    await run()

    const letters = json(Object.keys(zipFiles).find((k) => k.endsWith('our-year/letters.json')))
    expect(letters).toEqual([{ id: 'ch1', chapterId: 'ch1', sealed: true }])
    expect(manifest().stillSealed.ourYearLetters).toEqual(['ch1'])
  })
})

describe('Our Year, which belongs to two people rather than the family', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, blob: async () => new Blob(['x']) }))
  })

  it('exports the ritual, its chapters, and the exporter\'s own entries', async () => {
    respond({
      collections: {
        ourYearRituals: [{ id: 'r1', familyId: FAMILY, participantUids: [UID, 'uid-b'] }],
        ourYearChapters: [{
          id: 'ch1', familyId: FAMILY, ritualId: 'r1', participantUids: [UID, 'uid-b'],
          keepsakes: JSON.stringify({ photo: { url: 'https://cdn/keep.enc' } }),
        }],
        ourYearEntries: [{ id: 'ch1_reflection_' + UID, chapterId: 'ch1', authorUid: UID }],
      },
      letters: { ch1: { chapterId: 'ch1', sections: JSON.stringify([{ body: 'dear us' }]) } },
    })
    await run()

    const dir = (n) => json(Object.keys(zipFiles).find((k) => k.endsWith(`our-year/${n}`)))
    expect(dir('rituals.json')).toHaveLength(1)
    expect(dir('chapters.json')).toHaveLength(1)
    expect(dir('entries.json')).toHaveLength(1)
    expect(dir('letters.json')[0].sections).toEqual([{ body: 'dear us' }])
  })

  it('asks for entries by author, not by chapter', async () => {
    // A list mixing a revealed answer with the partner's unrevealed one is denied
    // wholesale, so asking for both would return nothing rather than half.
    respond({
      collections: {
        ourYearRituals: [{ id: 'r1', familyId: FAMILY, participantUids: [UID] }],
        ourYearChapters: [],
        ourYearEntries: [],
      },
    })
    await run()

    const entryQuery = getDocs.mock.calls
      .map(([q]) => q)
      .find((q) => q.ref.name === 'ourYearEntries')
    expect(entryQuery.c).toEqual(
      expect.arrayContaining([{ field: 'authorUid', op: '==', value: UID }]),
    )
  })

  it('downloads a chapter keepsake photo', async () => {
    respond({
      collections: {
        ourYearRituals: [{ id: 'r1', familyId: FAMILY, participantUids: [UID] }],
        ourYearChapters: [{
          id: 'ch1', familyId: FAMILY, ritualId: 'r1', participantUids: [UID],
          keepsakes: JSON.stringify({ photo: { url: 'https://cdn/keep.enc' } }),
        }],
        ourYearEntries: [],
      },
    })
    await run()

    expect(globalThis.fetch.mock.calls.map(([u]) => u)).toContain('https://cdn/keep.enc')
  })

  it('writes no our-year folder for someone who is not in a ritual', async () => {
    respond({ collections: {} })
    await run()

    expect(Object.keys(zipFiles).filter((k) => k.includes('our-year'))).toHaveLength(0)
  })

  it('ignores a ritual belonging to a different family', async () => {
    respond({
      collections: {
        ourYearRituals: [{ id: 'r1', familyId: 'other-family', participantUids: [UID] }],
      },
    })
    await run()

    expect(Object.keys(zipFiles).filter((k) => k.includes('our-year'))).toHaveLength(0)
  })
})

describe('what must never be in the archive', () => {
  it('still strips the family encryption key', async () => {
    respond({ collections: {} })
    globalThis.fetch = vi.fn()
    await run()

    const family = data('family.json')
    expect(family).not.toHaveProperty('encryptionKeyJwk')
    expect(JSON.stringify(family)).not.toContain('SECRET')
  })
})

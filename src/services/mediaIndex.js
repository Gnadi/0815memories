/**
 * Writing `mediaRefs` onto the documents from before them — phase 5 of
 * docs/plan-media-lifecycle.md.
 *
 * Documents written since phase 3 say which files they use. Older ones do not,
 * and the server cannot find out for them: media inside rich text is
 * encrypted. So this runs in an admin's browser, which has the family key. It
 * reads each of the family's documents that can hold media, decrypts it, works
 * out `mediaRefs` from the whole document (services/mediaRefs.js) and writes
 * the map in full, replacing whatever partial one later edits left there. The
 * trackMediaReferences trigger does the rest: files from before the ledger get
 * their entries, which are counted and never deleted.
 *
 * Nothing records how far a run got, as in services/thumbnailMigration.js: a
 * document whose map is already right is skipped, so a run can stop at any
 * point and the next one picks up where the data says. When a run gets
 * through everything, the family document notes when (`mediaIndexedAt`), so
 * the operator's report can tell which families are still to do.
 *
 * What it cannot reach is skipped, not failed: a sealed capsule's letter and
 * a closed Our Year chapter are refused to everyone until they open, and a
 * chapter belongs to its participants only.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from '../config/firestore'
import { db } from '../config/firebase'
import { devError } from '../utils/devLog'
import { decryptBestOf } from './bestOf'
import { decryptBoxContent, decryptBoxMetadata } from './blackbox'
import { decryptCollage } from './collages'
import { decryptHighlight } from './highlights'
import { decryptJournal } from './journals'
import { decryptKid } from './kids'
import { mediaRefsForCreate } from './mediaRefs'
import { decryptMemoryDoc } from './memories'
import { decryptMoment } from './moments'
import { decryptChapter } from './ourYear'
import { decryptRecipe } from './recipes'
import { decryptScrapbook } from './scrapbooks'

const byFamily = (name) => (familyId) => query(collection(db, name), where('familyId', '==', familyId))

// Every collection whose documents can hold media, with how to find the
// family's documents and how to read one in full. Mirrors MEDIA_COLLECTIONS in
// functions/mediaRefs.js.
const SOURCES = [
  { name: 'memories', list: byFamily('memories'), decrypt: decryptMemoryDoc },
  { name: 'moments', list: byFamily('moments'), decrypt: decryptMoment },
  { name: 'children', list: byFamily('children'), decrypt: decryptKid },
  { name: 'journals', list: byFamily('journals'), decrypt: decryptJournal },
  { name: 'blackbox', list: byFamily('blackbox'), decrypt: decryptBoxMetadata },
  { name: 'scrapbooks', list: byFamily('scrapbooks'), decrypt: (key, data) => decryptScrapbook(key, data, { withPages: true }) },
  { name: 'collages', list: byFamily('collages'), decrypt: (key, data) => decryptCollage(key, data, { withDoc: true }) },
  { name: 'highlights', list: byFamily('highlights'), decrypt: (key, data) => decryptHighlight(key, data, { withDoc: true }) },
  { name: 'bestOf', list: byFamily('bestOf'), decrypt: decryptBestOf },
  { name: 'recipes', list: byFamily('recipes'), decrypt: decryptRecipe },
  {
    name: 'ourYearChapters',
    // The read rule admits a chapter's participants only, so the query has to
    // say so; the family is checked on the results.
    list: (familyId, uid) => query(collection(db, 'ourYearChapters'), where('participantUids', 'array-contains', uid)),
    decrypt: decryptChapter,
  },
]

const withoutRefs = (data) => {
  const { mediaRefs: _ignored, ...rest } = data ?? {}
  return rest
}
const same = (a, b) => JSON.stringify(a ?? {}) === JSON.stringify(b ?? {})

/**
 * The documents to visit: every media document of the family, the family
 * document itself, and the letters of the family's capsules.
 *
 * @returns {Promise<Array<{ path: [string, string], decrypt: Function }>>}
 */
export async function scanMediaDocuments(familyId, uid) {
  if (!familyId || !db) return []
  const found = []
  for (const source of SOURCES) {
    const snapshot = await getDocs(source.list(familyId, uid))
    for (const snap of snapshot.docs) {
      if (snap.data().familyId !== familyId) continue
      found.push({ path: [source.name, snap.id], decrypt: source.decrypt })
      if (source.name === 'blackbox') {
        found.push({ path: ['blackboxContent', snap.id], decrypt: decryptBoxContent })
      }
    }
  }
  found.push({ path: ['families', familyId], decrypt: (_key, data) => data })
  return found
}

/**
 * Bring one document's `mediaRefs` in line with what it holds. In a
 * transaction, so an edit made meanwhile is not overwritten with a map worked
 * out from the version before it.
 *
 * @returns {Promise<'updated'|'unchanged'|'skipped'>}
 */
export async function indexDocument({ path, decrypt }, key) {
  const ref = doc(db, ...path)
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists()) return 'skipped'
      const data = snap.data()
      const plain = await decrypt(key, data)
      const { mediaRefs } = mediaRefsForCreate(withoutRefs(plain))
      if (same(mediaRefs, data.mediaRefs)) return 'unchanged'
      tx.update(ref, { mediaRefs })
      return 'updated'
    })
  } catch (err) {
    // Refused by the rules: a sealed letter, a closed chapter. Nothing to do
    // about it from here, and nothing the clean-up will act on.
    if (err?.code === 'permission-denied') return 'skipped'
    throw err
  }
}

/**
 * Visit every document, one at a time, like the other backfills: progress
 * stays truthful and stopping is immediate.
 *
 * @returns {Promise<{ done: number, total: number, updated: number, skipped: number, failed: number, stopped: boolean }>}
 */
export async function indexFamilyMedia(familyId, uid, key, { onProgress, shouldStop } = {}) {
  const documents = await scanMediaDocuments(familyId, uid)
  const stats = { done: 0, total: documents.length, updated: 0, skipped: 0, failed: 0, stopped: false }
  onProgress?.(0, stats.total)

  for (const document of documents) {
    if (shouldStop?.()) {
      stats.stopped = true
      break
    }
    try {
      const result = await indexDocument(document, key)
      if (result === 'updated') stats.updated++
      else if (result === 'skipped') stats.skipped++
    } catch (err) {
      devError('Media index failed for a document:', err)
      stats.failed++
    }
    stats.done++
    onProgress?.(stats.done, stats.total)
  }

  if (!stats.stopped && stats.failed === 0) {
    await updateDoc(doc(db, 'families', familyId), { mediaIndexedAt: serverTimestamp() })
  }
  return stats
}

/** When the family's documents were last all visited, or null. */
export async function getMediaIndexedAt(familyId) {
  if (!familyId || !db) return null
  const snap = await getDoc(doc(db, 'families', familyId))
  return snap.exists() ? (snap.data().mediaIndexedAt ?? null) : null
}

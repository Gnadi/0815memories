/**
 * The monthly best-of (utils/bestOf.js): one document per family and month,
 * holding the finished story.
 *
 * The id is `<familyId>_<YYYY-MM>`, so a month has exactly one, and two admins'
 * devices making it at the same time write the same document rather than two.
 * The rules hold the id to that shape.
 *
 * `doc` — the slides, their captions, places and photo URLs — is encrypted as
 * one JSON string, like a highlight's. `familyId` and `month` stay readable:
 * the server already knows both, it sends the push about the month.
 *
 * It also reads the month's memories and moments, which is what a best-of is
 * made of. `date` and `familyId` are never encrypted, which is what lets
 * Firestore hand over one month and nothing else.
 */
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from '../config/firestore'
import { auth, db } from '../config/firebase'
import { decryptJSON, encryptJSON } from '../utils/encryption'
import { monthRange } from '../utils/bestOf'
import { subscribeDecrypted } from './decrypted'
import { decryptMemory } from './memories'
import { decryptMoment } from './moments'

const BEST_OF = 'bestOf'

// Two years of them is more than any screen lists.
const LIST_LIMIT = 24

export const bestOfId = (familyId, month) => `${familyId}_${month}`

async function decryptBestOf(key, data) {
  if (!key) return data
  return { ...data, doc: typeof data.doc === 'string' ? await decryptJSON(key, data.doc) : data.doc }
}

/** The family's best-ofs, newest month first. */
export function bestOfListQuery(database, familyId) {
  return query(
    collection(database, BEST_OF),
    where('familyId', '==', familyId),
    orderBy('month', 'desc'),
    limit(LIST_LIMIT),
  )
}

/**
 * One month's, by query rather than by id: a get of a document that does not
 * exist has no `familyId` for the rules to check, so it would be denied rather
 * than come back empty — and "not made yet" is an everyday answer here.
 */
export function bestOfMonthQuery(database, familyId, month) {
  return query(
    collection(database, BEST_OF),
    where('familyId', '==', familyId),
    where('month', '==', month),
    limit(1),
  )
}

/** A month's memories or moments, newest first — the feed's index serves it. */
export function monthEntriesQuery(database, collectionName, familyId, month) {
  const [start, end] = monthRange(month)
  return query(
    collection(database, collectionName),
    where('familyId', '==', familyId),
    where('date', '>=', Timestamp.fromDate(start)),
    where('date', '<', Timestamp.fromDate(end)),
    orderBy('date', 'desc'),
  )
}

export function subscribeBestOfs(familyId, key, onData, onError) {
  return subscribeDecrypted(
    bestOfListQuery(db, familyId),
    (docs) => Promise.all(docs.map((d) => decryptBestOf(key, d))),
    onData,
    onError,
  )
}

/** The saved best-of of `month`, decrypted, or null when none has been made. */
export async function getBestOf(familyId, key, month) {
  const snapshot = await getDocs(bestOfMonthQuery(db, familyId, month))
  if (snapshot.empty) return null
  const [first] = snapshot.docs
  return decryptBestOf(key, { id: first.id, ...first.data() })
}

/** What a best-of is made of: the month's memories and moments, decrypted. */
export async function getMonthEntries(familyId, key, month) {
  const [memories, moments] = await Promise.all([
    getDocs(monthEntriesQuery(db, 'memories', familyId, month)),
    getDocs(monthEntriesQuery(db, 'moments', familyId, month)),
  ])
  return {
    memories: await Promise.all(memories.docs.map((d) => decryptMemory(key, { id: d.id, ...d.data() }))),
    moments: await Promise.all(moments.docs.map((d) => decryptMoment(key, { id: d.id, ...d.data() }))),
  }
}

/**
 * The document as it is written — exactly these fields, which the rules
 * insist on: nothing about the story outside the encrypted `doc`.
 */
export async function bestOfDocument(familyId, key, bestOf) {
  return {
    familyId,
    month: bestOf.month,
    version: bestOf.version,
    doc: await encryptJSON(key, bestOf),
    createdByUid: auth?.currentUser?.uid || null,
    createdAt: serverTimestamp(),
  }
}

/** Save a month's best-of, replacing one made before. Admins only. */
export async function saveBestOf(familyId, key, bestOf) {
  await setDoc(doc(db, BEST_OF, bestOfId(familyId, bestOf.month)), await bestOfDocument(familyId, key, bestOf))
}

/**
 * The trash: what the family deleted in the last TRASH_DAYS days.
 *
 * Deleting moves a document to trash/<collection>__<id> instead of removing it.
 * The entry holds the document exactly as it was stored, in `data` — encrypted
 * fields stay encrypted — and restoring writes those same bytes back.
 * firestore.rules holds both moves to that: the trash is no way to write what
 * a collection would refuse, such as a capsule with an earlier unlock date.
 *
 * Some things are more than one document, and move together under one
 * `group`: a child with their journal, a recipe with the versions grown from
 * it. A capsule moves without its letter, which nobody may read before its
 * date; the letter stays where it is, sealed, and has no capsule to open it
 * until the capsule comes back.
 *
 * After TRASH_DAYS, or once someone deletes an entry for good (`purgeNow`), the
 * purgeTrash function deletes it on the server, with the Cloudinary files only
 * it used: `media`. Which files those are is worked out here, because only here
 * can the documents be read. A collage, a scrapbook or a highlight shows photos
 * of the memories they were made from, and says so only in encrypted fields.
 * A file that something else still shows, live or in the trash, stays.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from '../config/firestore'
import { auth, db } from '../config/firebase'
import { decryptBoxMetadata } from './blackbox'
import { decryptCollage } from './collages'
import { decryptHighlight } from './highlights'
import { decryptJournal } from './journals'
import { decryptKid } from './kids'
import { decryptMemory, decryptMemoryDoc } from './memories'
import { decryptMoment } from './moments'
import { decryptRecipe, forksOf } from './recipes'
import { decryptScrapbook } from './scrapbooks'
import { subscribeDecrypted } from './decrypted'
import { mediaIn } from '../utils/mediaUrls'
import { devError } from '../utils/devLog'

const TRASH = 'trash'

// The purge function counts the same days (functions/purge.js).
export const TRASH_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

// firestore.rules (trashable()) lists the same collections.
export const TRASHABLE = [
  'memories', 'moments', 'journals', 'children', 'recipes',
  'scrapbooks', 'collages', 'highlights', 'blackbox',
]

// Every entry costs the rules two document reads, going in and coming back,
// and a batch gets twenty.
const BATCH_SIZE = 5

// The documents that can show the same file: memories and moments trade
// theirs when one becomes the other, and these three are built from memories'
// photos.
const SHARING = new Set(['memories', 'moments', 'scrapbooks', 'collages', 'highlights'])
const BUILT_FROM_PHOTOS = ['scrapbooks', 'collages', 'highlights']

// Whole documents, for finding the files in them.
const DECRYPT_FULLY = {
  memories: decryptMemoryDoc,
  moments: decryptMoment,
  journals: decryptJournal,
  children: decryptKid,
  recipes: decryptRecipe,
  scrapbooks: decryptScrapbook,
  collages: decryptCollage,
  highlights: decryptHighlight,
  blackbox: decryptBoxMetadata,
}

// Just enough for the trash's list to say what an entry is.
const DECRYPT_TITLE = {
  ...DECRYPT_FULLY,
  memories: decryptMemory,
  scrapbooks: (key, data) => decryptScrapbook(key, data, { withPages: false }),
  collages: (key, data) => decryptCollage(key, data, { withDoc: false }),
  highlights: (key, data) => decryptHighlight(key, data, { withDoc: false }),
}

export const trashId = (collectionName, id) => `${collectionName}__${id}`

const chunks = (items, size) => {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function decryptedMedia(key, collectionName, data) {
  const decrypt = DECRYPT_FULLY[collectionName]
  try {
    return mediaIn(decrypt ? await decrypt(key, data) : data)
  } catch {
    // What cannot be decrypted names no files that could be found anyway;
    // its fields in clear still do.
    return mediaIn(data)
  }
}

/**
 * The documents deleting one document deletes. The one asked for comes last,
 * so that if a batch fails part-way it is still there to delete again.
 */
async function bundleOf(collectionName, id) {
  const snap = await getDoc(doc(db, collectionName, id))
  if (!snap.exists()) return []
  const asked = { collection: collectionName, id, data: snap.data() }
  const { familyId } = asked.data
  let more = []
  if (collectionName === 'children') {
    const journals = await getDocs(query(
      collection(db, 'journals'), where('familyId', '==', familyId), where('childId', '==', id),
    ))
    more = journals.docs.map((d) => ({ collection: 'journals', id: d.id, data: d.data() }))
  } else if (collectionName === 'recipes') {
    const forks = await getDocs(forksOf(familyId, id))
    more = forks.docs.map((d) => ({ collection: 'recipes', id: d.id, data: d.data() }))
  }
  return [...more, asked]
}

/**
 * Of `candidates`, the files something other than `moving` still shows: a live
 * memory, moment, scrapbook, collage or highlight, or something in the trash.
 */
async function mediaInUseElsewhere(key, familyId, candidates, moving) {
  const inUse = new Set()
  const note = (urls) => { for (const url of urls) if (candidates.has(url)) inUse.add(url) }
  const urls = [...candidates]

  // Memories and moments name their photos in clear, so a query finds the
  // ones that show a candidate.
  const lookups = []
  for (const coll of ['memories', 'moments']) {
    for (const part of chunks(urls, 30)) {
      for (const field of ['images', 'thumbs']) {
        lookups.push(getDocs(query(
          collection(db, coll), where('familyId', '==', familyId), where(field, 'array-contains-any', part),
        )).then((snap) => snap.docs.map((d) => ({ collection: coll, id: d.id, data: d.data() }))))
      }
      lookups.push(getDocs(query(
        collection(db, coll), where('familyId', '==', familyId), where('imageUrl', 'in', part),
      )).then((snap) => snap.docs.map((d) => ({ collection: coll, id: d.id, data: d.data() }))))
    }
  }
  // The rest say so only in encrypted fields: all of them, decrypted.
  for (const coll of BUILT_FROM_PHOTOS) {
    lookups.push(getDocs(query(collection(db, coll), where('familyId', '==', familyId)))
      .then((snap) => snap.docs.map((d) => ({ collection: coll, id: d.id, data: d.data() }))))
  }
  lookups.push(getDocs(query(collection(db, TRASH), where('familyId', '==', familyId)))
    .then((snap) => snap.docs
      // Gone within the hour anyway, and taking their files with them.
      .filter((d) => !d.data().purgeNow)
      .map((d) => ({ collection: d.data().collection, id: d.data().docId, data: d.data().data }))))

  const others = (await Promise.all(lookups)).flat()
    .filter((item) => !moving.has(trashId(item.collection, item.id)))
  for (const item of others) note(await decryptedMedia(key, item.collection, item.data))
  return inUse
}

/** For each document moving to the trash, the files that go with it. */
async function mediaFor(key, items) {
  const own = new Map()
  for (const item of items) {
    own.set(trashId(item.collection, item.id), await decryptedMedia(key, item.collection, item.data))
  }
  const candidates = new Set([...own.values()].flatMap((urls) => [...urls]))
  if (!candidates.size || !items.some((item) => SHARING.has(item.collection))) return own

  const moving = new Set(own.keys())
  let inUse
  try {
    inUse = await mediaInUseElsewhere(key, items[0].data.familyId, candidates, moving)
  } catch (err) {
    // Say, an index still building after a deploy. Deleting still works; it
    // only keeps every file, which is the side to err on.
    devError('Could not tell which files are shared; keeping them all:', err)
    inUse = candidates
  }
  for (const [id, urls] of own) own.set(id, new Set([...urls].filter((url) => !inUse.has(url))))
  return own
}

/** Deleting: the document, and what belongs to it, into the trash. */
export async function moveToTrash(key, collectionName, id) {
  if (!TRASHABLE.includes(collectionName)) throw new Error(`${collectionName} has no trash`)
  const items = await bundleOf(collectionName, id)
  if (!items.length) return
  const media = await mediaFor(key, items)
  const group = trashId(collectionName, id)
  const deletedBy = auth?.currentUser?.uid ?? null

  for (const part of chunks(items, BATCH_SIZE)) {
    const batch = writeBatch(db)
    for (const item of part) {
      const entryId = trashId(item.collection, item.id)
      batch.set(doc(db, TRASH, entryId), {
        familyId: item.data.familyId,
        collection: item.collection,
        docId: item.id,
        data: item.data,
        group,
        media: [...(media.get(entryId) ?? [])],
        deletedAt: serverTimestamp(),
        deletedBy,
      })
      batch.delete(doc(db, item.collection, item.id))
    }
    await batch.commit()
  }
}

function titleOf(entry, decrypted) {
  switch (entry.collection) {
    case 'moments': return decrypted.caption || decrypted.label || ''
    case 'children': return decrypted.name || ''
    default: return decrypted.title || ''
  }
}

async function describe(key, entry) {
  const decrypt = DECRYPT_TITLE[entry.collection]
  let decrypted = entry.data ?? {}
  try {
    if (decrypt) decrypted = await decrypt(key, decrypted)
  } catch {
    // An entry whose title will not decrypt is still worth restoring.
  }
  const deletedAt = entry.deletedAt?.toDate?.() ?? new Date()
  return {
    id: entry.id,
    collection: entry.collection,
    docId: entry.docId,
    group: entry.group,
    data: entry.data,
    title: titleOf(entry, decrypted),
    date: decrypted.date?.toDate?.() ?? null,
    deletedAt,
  }
}

/**
 * What a group looks like in the list: the document that was deleted, how many
 * more went with it, and when it goes for good.
 */
function groupsOf(entries) {
  const groups = new Map()
  for (const entry of entries) {
    if (!groups.has(entry.group)) groups.set(entry.group, [])
    groups.get(entry.group).push(entry)
  }
  return [...groups.entries()].map(([id, members]) => {
    const lead = members.find((m) => m.id === id) ?? members[0]
    return {
      id,
      collection: lead.collection,
      title: lead.title,
      date: lead.date,
      deletedAt: lead.deletedAt,
      purgeAt: new Date(lead.deletedAt.getTime() + TRASH_DAYS * DAY_MS),
      more: members.length - 1,
      entries: members,
    }
  }).sort((a, b) => b.deletedAt - a.deletedAt)
}

/** The family's trash, newest first, one item per group. */
export function subscribeTrash(familyId, key, onData, onError) {
  return subscribeDecrypted(
    query(collection(db, TRASH), where('familyId', '==', familyId), orderBy('deletedAt', 'desc')),
    async (docs) => groupsOf(await Promise.all(
      docs.filter((d) => !d.purgeNow).map((d) => describe(key, d)),
    )),
    onData,
    onError,
  )
}

/** Restoring: every document of the group back where it was, as it was. */
export async function restoreFromTrash(group) {
  const entries = [
    ...group.entries.filter((e) => e.id !== group.id),
    ...group.entries.filter((e) => e.id === group.id),
  ]
  for (const part of chunks(entries, BATCH_SIZE)) {
    const batch = writeBatch(db)
    for (const entry of part) {
      batch.set(doc(db, entry.collection, entry.docId), entry.data)
      batch.delete(doc(db, TRASH, entry.id))
    }
    await batch.commit()
  }
}

/**
 * Deleting for good. The purge function takes it from here, within the hour:
 * the files are on Cloudinary, and only the server may delete those.
 */
export async function deleteForever(group) {
  for (const part of chunks(group.entries, 400)) {
    const batch = writeBatch(db)
    for (const entry of part) batch.update(doc(db, TRASH, entry.id), { purgeNow: true })
    await batch.commit()
  }
}

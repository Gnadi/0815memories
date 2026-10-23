/**
 * What a document says about the Cloudinary files it uses — phase 3 of
 * docs/plan-media-lifecycle.md.
 *
 * The server keeps a ledger of every uploaded file (functions/mediaSigning.js)
 * and will delete the ones no document uses. It cannot find them itself: media
 * inside rich text is encrypted with the rest of the document. So every write
 * of a document that can hold media carries `mediaRefs`, worked out here from
 * the plaintext before it is encrypted, and the trackMediaRefs trigger
 * (functions/mediaRefs.js) keeps the ledger in step with it.
 *
 * `mediaRefs` is a map from each top-level field to the public ids found in it,
 * not one list for the document, because most writes are partial: an update
 * that changes only the title must not make the photos look unused. A partial
 * write replaces the entries of exactly the fields it writes, through field
 * paths, and leaves the rest alone.
 *
 * The ids are the files signUpload named (`kaydo/<familyId>/<id>`, or under
 * `kaydo/public/`). They point at ciphertext and are no more telling than the
 * URLs documents already carry in clear. Files from before the ledger have
 * other ids and are not tracked yet.
 */
import { deleteField } from '../config/firestore'

const PUBLIC_ID = /kaydo\/(?:public\/)?[A-Za-z0-9_-]{1,100}\/[0-9a-f]{32}(?![0-9a-f])/g

const isPlainObject = (v) => !!v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype

/**
 * Whether a field, as written, could hold media. Timestamps, numbers, flags
 * and Firestore sentinels cannot, so a partial write leaves their entries
 * alone rather than writing a deletion for every one of them.
 */
const mayCarry = (value) => typeof value === 'string' || Array.isArray(value) || isPlainObject(value)

const carries = (key) => key !== 'mediaRefs'

// deleteField() is an opaque sentinel in the SDK and a tagged object in the
// demo database; both are recognised by asking for a fresh one to compare
// against. A field cleared that way loses its media with it.
const isDeletion = (value) => {
  if (!value || typeof value !== 'object') return false
  const sentinel = deleteField()
  return typeof value.isEqual === 'function' ? value.isEqual(sentinel) : value.kind === 'deleteField'
}

/** A field written as text, a list, a map, null or deleteField(). */
const mayChangeMedia = (key, value) =>
  carries(key) && (mayCarry(value) || value === null || isDeletion(value))

/**
 * Every public id in a value: URLs, bare ids, and either inside a JSON string
 * such as a rich document. Sorted, without repeats.
 */
export function mediaIdsIn(value) {
  const found = new Set()
  const walk = (v) => {
    if (typeof v === 'string') {
      for (const match of v.matchAll(PUBLIC_ID)) found.add(match[0])
    } else if (Array.isArray(v)) {
      v.forEach(walk)
    } else if (isPlainObject(v)) {
      Object.values(v).forEach(walk)
    }
  }
  walk(value)
  return [...found].sort()
}

/**
 * `mediaRefs` for a document written whole (addDoc, setDoc without merge,
 * batch.set): one entry per field that holds media.
 *
 * @param {object} plain  the document before encryption
 * @returns {{ mediaRefs: Record<string, string[]> }}
 */
export function mediaRefsForCreate(plain) {
  const mediaRefs = {}
  for (const [key, value] of Object.entries(plain ?? {})) {
    if (!carries(key)) continue
    const ids = mediaIdsIn(value)
    if (ids.length) mediaRefs[key] = ids
  }
  return { mediaRefs }
}

/**
 * Field paths for a partial write (updateDoc, batch.update): the entry of every
 * field written is replaced, and removed when the field no longer holds media.
 *
 * @param {object} plain  the fields being written, before encryption
 * @returns {Record<string, string[] | ReturnType<typeof deleteField>>}
 */
export function mediaRefsForUpdate(plain) {
  const paths = {}
  for (const [key, value] of Object.entries(plain ?? {})) {
    if (!mayChangeMedia(key, value)) continue
    const ids = mediaIdsIn(value)
    paths[`mediaRefs.${key}`] = ids.length ? ids : deleteField()
  }
  return paths
}

/**
 * The same for setDoc with `{ merge: true }`, which takes a nested map rather
 * than field paths.
 *
 * @param {object} plain  the fields being written, before encryption
 * @returns {{ mediaRefs: Record<string, string[] | ReturnType<typeof deleteField>> }}
 */
export function mediaRefsForMerge(plain) {
  const mediaRefs = {}
  for (const [key, value] of Object.entries(plain ?? {})) {
    if (!mayChangeMedia(key, value)) continue
    const ids = mediaIdsIn(value)
    mediaRefs[key] = ids.length ? ids : deleteField()
  }
  return { mediaRefs }
}

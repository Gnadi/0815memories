/**
 * Permission to upload a print file — the other half of storage.rules.
 *
 * A print file is up to 300 MB of unencrypted PDF in the project's shared
 * Storage bucket, and any account with a confirmed address can found a family
 * and become its admin. Rules that only ask "is this an admin of the family?"
 * therefore leave the upload volume unbounded: such an account could write
 * under as many new folders as it likes. So a folder exists only if the server
 * has issued it, and the server issues a limited number per family.
 *
 * `printReservations/{printId}` is that issue: storage.rules lets a file be
 * created in `printFiles/{familyId}/{printId}/` only while the document exists,
 * names the same family and has not run out. The browser cannot write the
 * collection (firestore.rules), so asking here is the only way to get one.
 *
 * Nothing here imports firebase-admin or firebase-functions: Firestore, the
 * clock and the id generator come in as arguments, so the tests can stub them.
 */

export const PRINT_RESERVATIONS = 'printReservations'

/**
 * How long a reservation lets the browser start its uploads. The print file is
 * rendered before it is asked for, so this only has to cover the upload.
 */
export const RESERVATION_VALID_MS = 60 * 60 * 1000

/** Reservations a family may take in any PRINT_QUOTA_WINDOW_DAYS: several books, and a few retries. */
export const DEFAULT_PRINT_RESERVATIONS_PER_WINDOW = 5
export const PRINT_QUOTA_WINDOW_DAYS = 30

// The marker collection of functions/familyDeletion.js, which imports
// printFiles.js and so must not be imported from a module that it also reads.
const FAMILY_DELETIONS = 'familyDeletions'
const FAMILY_ID = /^[A-Za-z0-9_-]{1,100}$/
const DAY_MS = 24 * 60 * 60 * 1000

export class ReservationError extends Error {
  /** @param {'unauthenticated'|'invalid-argument'|'permission-denied'|'failed-precondition'|'resource-exhausted'} code */
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

const millisOf = (value) => {
  if (value == null) return NaN
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (value instanceof Date) return value.getTime()
  return Number(value)
}

function adminUidsOf(data) {
  return Array.isArray(data?.adminUids) ? data.adminUids : []
}

/** Has the family's deletion begun, or is its date reached? */
function isBeingDeleted(familyData, marker, at) {
  return marker.exists || millisOf(familyData?.deletion?.deleteAfter) <= at
}

/**
 * Give an admin the right to upload one print file.
 *
 * @param {object} deps
 * @param {import('firebase-admin/firestore').Firestore} deps.db
 * @param {number} [deps.limit]       reservations per PRINT_QUOTA_WINDOW_DAYS
 * @param {() => number} [deps.now]
 * @param {() => string} deps.randomId  a random UUID
 * @param {string|undefined} uid      the caller
 * @param {unknown} data              the callable's payload
 * @returns {Promise<{ printId: string, expiresAt: string }>}
 */
export async function reservePrintUpload(deps, uid, data) {
  const { db, limit = DEFAULT_PRINT_RESERVATIONS_PER_WINDOW, now = Date.now, randomId } = deps
  if (!uid) throw new ReservationError('unauthenticated', 'Sign in first')

  const familyId = typeof data?.familyId === 'string' ? data.familyId : ''
  if (!FAMILY_ID.test(familyId)) throw new ReservationError('invalid-argument', 'No family given')

  const at = now()
  const familyRef = db.doc(`families/${familyId}`)
  const markerRef = db.collection(FAMILY_DELETIONS).doc(familyId)
  // The family document, not the caller's claim: it is the source of truth,
  // and storage.rules asks it the same question.
  const printId = randomId()
  const reservationRef = db.collection(PRINT_RESERVATIONS).doc(printId)
  const mine = db.collection(PRINT_RESERVATIONS).where('familyId', '==', familyId)

  // One transaction, so two tabs asking at once cannot both take the last place.
  return db.runTransaction(async (tx) => {
    const [family, marker, existing] = await Promise.all([tx.get(familyRef), tx.get(markerRef), tx.get(mine)])
    if (!family.exists || !adminUidsOf(family.data()).includes(uid)) {
      throw new ReservationError('permission-denied', 'Only family admins can upload a print file')
    }
    // A family being deleted takes no new files: the deletion would race the
    // upload and leave an unencrypted copy behind.
    if (isBeingDeleted(family.data(), marker, at)) {
      throw new ReservationError('failed-precondition', 'This family is being deleted')
    }

    const cutoff = at - PRINT_QUOTA_WINDOW_DAYS * DAY_MS
    const recent = existing.docs.filter((snap) => millisOf(snap.data().createdAt) >= cutoff)
    if (recent.length >= limit) {
      throw new ReservationError('resource-exhausted', 'This family has used its print uploads for now')
    }
    // Older ones have counted for the whole window and are of no use any more.
    for (const snap of existing.docs) {
      if (!recent.includes(snap)) tx.delete(snap.ref)
    }

    const expireAt = new Date(at + RESERVATION_VALID_MS)
    tx.set(reservationRef, { familyId, createdBy: uid, createdAt: new Date(at), expireAt })
    return { printId, expiresAt: expireAt.toISOString() }
  })
}

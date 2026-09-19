/**
 * Where a print-ready PDF lives between this browser and a print network.
 *
 * Everything else in Kaydo travels as ciphertext: photos are encrypted in the
 * browser and Cloudinary only ever holds bytes nobody can render. A press
 * cannot work that way — it needs a PDF it can fetch and put on paper — so this
 * one file, and only this one, leaves as plaintext.
 *
 * The shape of that exception is the whole point of this module:
 *
 *  - it is written only when a human asks for a printed book, never on save;
 *  - it lands under an unguessable name inside the family's own folder;
 *  - Storage rules keep it unreadable to every other family, while the
 *    tokenised download URL — which bypasses those rules by design — is what
 *    the printer gets, and nothing else;
 *  - it is deleted as soon as the order no longer needs it.
 *
 * Requires the Blaze plan: Cloud Storage is not part of Spark. Until the
 * project has it, `uploadPrintFile` fails with `PRINT_STORAGE_UNAVAILABLE`
 * rather than a stack trace, and the local download path still works.
 */

import { getStorageInstance } from '../config/firebase'

/** Thrown when the bucket is missing, unprovisioned, or the plan does not include it. */
export const PRINT_STORAGE_UNAVAILABLE = 'PRINT_STORAGE_UNAVAILABLE'

export class PrintStorageError extends Error {
  constructor(code, message, cause) {
    super(message)
    this.name = 'PrintStorageError'
    this.code = code
    this.cause = cause
  }
}

/**
 * The path a family's print file lives at.
 *
 * The random segment is what keeps the file private even from somebody who
 * knows the family and scrapbook ids: the download URL a printer receives is
 * unguessable, and it stops resolving the moment the file is deleted.
 */
export function printFilePath(familyId, scrapbookId, token = crypto.randomUUID()) {
  return `printFiles/${familyId}/${scrapbookId}/${token}.pdf`
}

/**
 * Make a filename safe to sit inside a Content-Disposition header.
 *
 * `exportFileName` already strips control characters and quotes, so today's
 * caller is safe — but this value goes into a header, and a header built from a
 * caller's promise is a header waiting for a caller that forgets. A CR or LF
 * here would split the response; a quote would end the filename parameter early.
 */
function headerSafeFileName(name) {
  const cleaned = Array.from(String(name ?? ''), (char) => (char < ' ' || char === '"' || char === '\\' || char === '\u007f' ? '' : char))
    .join('')
    .slice(0, 120)
    .trim()
  return cleaned || 'scrapbook.pdf'
}

async function requireStorage() {
  const storage = await getStorageInstance()
  if (!storage) {
    throw new PrintStorageError(
      PRINT_STORAGE_UNAVAILABLE,
      'Firebase Storage is not available in this project.'
    )
  }
  return storage
}

/**
 * Upload a print PDF and return the URL a print network can fetch it from.
 *
 * `contentDisposition` gives the file a human name in the printer's system —
 * their support staff see a filename, not a UUID, when something needs chasing.
 */
export async function uploadPrintFile(blob, { familyId, scrapbookId, fileName = 'scrapbook.pdf', onProgress } = {}) {
  if (!familyId || !scrapbookId) throw new PrintStorageError('INVALID_TARGET', 'familyId and scrapbookId are required')
  if (!blob) throw new PrintStorageError('INVALID_FILE', 'No file to upload')

  const storage = await requireStorage()
  const { ref, uploadBytesResumable, getDownloadURL } = await import('firebase/storage')

  const path = printFilePath(familyId, scrapbookId)
  const fileRef = ref(storage, path)

  const task = uploadBytesResumable(fileRef, blob, {
    contentType: 'application/pdf',
    contentDisposition: `attachment; filename="${headerSafeFileName(fileName)}"`,
    // Who this belongs to, readable from the console when an order needs
    // tracing back to a book without decrypting anything.
    customMetadata: { familyId, scrapbookId },
  })

  if (onProgress) {
    task.on('state_changed', (snap) => {
      onProgress({
        phase: 'upload',
        done: snap.bytesTransferred,
        total: snap.totalBytes,
      })
    })
  }

  try {
    await task
  } catch (err) {
    // An unprovisioned bucket and a missing plan both arrive here as a generic
    // failure; the one thing the user must not be told is "try again".
    const code = err?.code === 'storage/unknown' || err?.code === 'storage/unauthorized'
      ? PRINT_STORAGE_UNAVAILABLE
      : err?.code || 'UPLOAD_FAILED'
    throw new PrintStorageError(code, err?.message || 'Upload failed', err)
  }

  const url = await getDownloadURL(fileRef)
  return { path, url, bytes: blob.size }
}

/**
 * Remove a print file once the press no longer needs it.
 *
 * Deliberately forgiving: a file that is already gone is the outcome we wanted,
 * and a failed cleanup must never take an otherwise-good order down with it.
 */
export async function deletePrintFile(path) {
  if (!path) return false
  try {
    const storage = await getStorageInstance()
    if (!storage) return false
    const { ref, deleteObject } = await import('firebase/storage')
    await deleteObject(ref(storage, path))
    return true
  } catch (err) {
    if (err?.code === 'storage/object-not-found') return true
    return false
  }
}

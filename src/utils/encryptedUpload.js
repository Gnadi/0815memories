// The blur-up preview is stored on the document (thumbsTiny), but it is made
// here, from the picture being uploaded, so it is encrypted here as well.
// eslint-disable-next-line no-restricted-imports
import { encryptBlob, encryptText } from './encryption'
import { createThumbnail, createTinyPreview } from './imageThumbnail'
import { MAX_PLAINTEXT_BYTES } from '../constants/media'
import { fetchUploadSignature, signedUploadForm, signedUploadUrl } from './uploadSignature'
import { isDemoMode } from '../demo/demoMode'

// Thrown before anything is encrypted or sent when the file cannot possibly fit
// under Cloudinary's raw-resource cap. Callers match on `code` rather than
// `instanceof` so the check survives module mocks and bundler boundaries.
export const UPLOAD_TOO_LARGE = 'upload/too-large'

export function uploadTooLargeError(size, limit) {
  const err = new Error(`File is ${size} bytes, upload limit is ${limit} bytes`)
  err.code = UPLOAD_TOO_LARGE
  err.size = size
  err.limit = limit
  return err
}

async function uploadEncryptedBlob(blob, encryptionKey) {
  // 0. Refuse oversized files up front. Encrypting first would read the whole
  // file into memory (three copies at peak) only for Cloudinary to answer 400.
  if (blob.size > MAX_PLAINTEXT_BYTES) {
    throw uploadTooLargeError(blob.size, MAX_PLAINTEXT_BYTES)
  }

  // The demo keeps what is added to it in this tab (demo/demoMode.js): an
  // object URL, which the media components show as it is (isDirectUrl in
  // useDecryptedMedia) and which goes with the tab like the rest of the demo.
  // Nothing is encrypted — the demo family has no key — and nothing is sent.
  if (isDemoMode()) return { url: URL.createObjectURL(blob), publicId: '' }

  // 1. Encrypt, and meanwhile get a signature for this one file (a raw
  // resource). Asked for before the first await, so the files of one choice
  // ask in the same task and are signed in one call (uploadSignature.js).
  const [encryptedBuffer, signed] = await Promise.all([
    encryptBlob(encryptionKey, blob),
    fetchUploadSignature('encrypted'),
  ])
  const encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' })

  // 2. Upload encrypted blob to Cloudinary as raw
  const response = await fetch(signedUploadUrl(signed), {
    method: 'POST',
    body: signedUploadForm(encryptedBlob, 'encrypted.dat', signed),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    // Cloudinary reports the reason in the body, and also in X-Cld-Error when
    // the body is empty (which is what a rejected oversized upload returns).
    const reason =
      err?.error?.message ||
      response.headers?.get?.('x-cld-error') ||
      `Upload failed (${response.status})`
    if (/file size too large|too large/i.test(reason)) {
      throw uploadTooLargeError(blob.size, MAX_PLAINTEXT_BYTES)
    }
    throw new Error(reason)
  }

  const data = await response.json()
  return { url: data.secure_url, publicId: data.public_id }
}

/**
 * Encrypt a file/blob and upload it to Cloudinary as a raw resource.
 * Returns { url, publicId } on success.
 */
export async function encryptAndUpload(file, encryptionKey) {
  const blob = file instanceof Blob ? file : new Blob([file])
  return uploadEncryptedBlob(blob, encryptionKey)
}

/**
 * Same as encryptAndUpload, plus a separately encrypted downscaled copy.
 *
 * Returns { url, publicId, thumbUrl, thumbPublicId }. The thumb fields are
 * empty strings whenever a thumbnail could not be produced or uploaded — the
 * original is always what matters, so a thumbnail failure must never fail the
 * upload. Readers fall back to the original when a thumb is missing.
 *
 * The thumbnail is made and uploaded alongside the original rather than after
 * it: nothing is kept until the form is saved, and the form waits for both, so
 * waiting only added the thumbnail's time to every photo. A thumbnail whose
 * original then fails is a file no document uses, which the clean-up removes.
 */
export async function encryptAndUploadWithThumb(file, encryptionKey) {
  const blob = file instanceof Blob ? file : new Blob([file])
  const original = uploadEncryptedBlob(blob, encryptionKey)

  const thumb = (async () => {
    try {
      const thumbBlob = await createThumbnail(blob)
      return thumbBlob ? await uploadEncryptedBlob(thumbBlob, encryptionKey) : null
    } catch {
      return null
    }
  })()

  // The blur-up preview is not uploaded: it is encrypted as text and stored on
  // the document itself, which is the whole point — it arrives with the fields
  // the feed already decrypts, costing no request. Encrypted here so the caller
  // never holds a plaintext copy of anything.
  const tinyPreview = (async () => {
    try {
      const dataUrl = await createTinyPreview(blob)
      return dataUrl ? await encryptText(encryptionKey, dataUrl) : ''
    } catch {
      return ''
    }
  })()

  const [stored, thumbStored, tiny] = await Promise.all([original, thumb, tinyPreview])
  return {
    ...stored,
    thumbUrl: thumbStored?.url ?? '',
    thumbPublicId: thumbStored?.publicId ?? '',
    tinyPreview: tiny,
  }
}

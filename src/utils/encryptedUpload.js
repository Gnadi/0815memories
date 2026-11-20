// The blur-up preview is stored on the document (thumbsTiny), but it is made
// here, from the picture being uploaded, so it is encrypted here as well.
// eslint-disable-next-line no-restricted-imports
import { encryptBlobToBlob, encryptText } from './encryption'
import { createDerivatives } from './imageThumbnail'
import { fitImageToLimit } from './imageCompression'
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
  const [encryptedBlob, signed] = await Promise.all([
    encryptBlobToBlob(encryptionKey, blob),
    fetchUploadSignature('encrypted'),
  ])

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
  // Photos over 4096 px or the size limit are scaled down first
  // (imageCompression.js). Inside the slot, because decoding one is what
  // takes the memory.
  return withUploadSlot(async () => uploadEncryptedBlob(await fitImageToLimit(blob), encryptionKey))
}

// Files worked on at once. Each holds its plaintext, its ciphertext and, for a
// photo, a decoded bitmap of tens of megabytes; a choice of twenty photos all
// at once could run a phone out of memory. Three keep the network busy.
const FILES_AT_ONCE = 3
let running = 0
const waiting = []

async function withUploadSlot(task) {
  // A finished upload hands its slot straight to the next one waiting, so a
  // newcomer cannot take it in between and make it four.
  if (running < FILES_AT_ONCE) running++
  else await new Promise((resolve) => waiting.push(resolve))
  try {
    return await task()
  } finally {
    const next = waiting.shift()
    if (next) next()
    else running--
  }
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
  return withUploadSlot(async () => {
    // The thumbnails are made from the scaled copy too: the same picture, and
    // a quarter of the pixels to decode.
    const blob = await fitImageToLimit(file instanceof Blob ? file : new Blob([file]))
    const original = uploadEncryptedBlob(blob, encryptionKey)

    // Both derivatives come from one decode of the photo (createDerivatives).
    // The blur-up preview is not uploaded: it is encrypted as text and stored
    // on the document itself, which is the whole point — it arrives with the
    // fields the feed already decrypts, costing no request. Encrypted here so
    // the caller never holds a plaintext copy of anything.
    const derived = (async () => {
      let made = { thumb: null, tiny: null }
      try {
        made = await createDerivatives(blob)
      } catch {
        // Neither, then; the original is what matters.
      }
      const [thumb, tiny] = await Promise.all([
        made.thumb ? uploadEncryptedBlob(made.thumb, encryptionKey).catch(() => null) : null,
        made.tiny ? encryptText(encryptionKey, made.tiny).catch(() => '') : '',
      ])
      return { thumb, tiny }
    })()

    const [stored, { thumb, tiny }] = await Promise.all([original, derived])
    return {
      ...stored,
      thumbUrl: thumb?.url ?? '',
      thumbPublicId: thumb?.publicId ?? '',
      tinyPreview: tiny,
    }
  })
}

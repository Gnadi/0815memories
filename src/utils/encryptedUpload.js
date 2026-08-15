import { encryptBlob, encryptText } from './encryption'
import { createThumbnail, createTinyPreview } from './imageThumbnail'
import { CLOUDINARY_CLOUD_NAME } from '../config/cloudinary'
import { MAX_PLAINTEXT_BYTES } from '../constants/media'

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

  // 1. Encrypt
  const encryptedBuffer = await encryptBlob(encryptionKey, blob)
  const encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' })

  // 2. Get signed upload credentials for raw resource type
  const signRes = await fetch('/api/cloudinary-sign?resource_type=raw')
  if (!signRes.ok) throw new Error('Failed to get upload signature')
  const { timestamp, signature, folder, apiKey } = await signRes.json()

  // 3. Upload encrypted blob to Cloudinary as raw
  const formData = new FormData()
  formData.append('file', encryptedBlob, 'encrypted.dat')
  formData.append('timestamp', String(timestamp))
  formData.append('signature', signature)
  formData.append('api_key', apiKey)
  formData.append('folder', folder)

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`,
    { method: 'POST', body: formData }
  )

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
 */
export async function encryptAndUploadWithThumb(file, encryptionKey) {
  const blob = file instanceof Blob ? file : new Blob([file])
  const original = await uploadEncryptedBlob(blob, encryptionKey)

  let thumb = null
  try {
    const thumbBlob = await createThumbnail(blob)
    if (thumbBlob) thumb = await uploadEncryptedBlob(thumbBlob, encryptionKey)
  } catch {
    thumb = null
  }

  // The blur-up preview is not uploaded: it is encrypted as text and stored on
  // the document itself, which is the whole point — it arrives with the fields
  // the feed already decrypts, costing no request. Encrypted here so the caller
  // never holds a plaintext copy of anything.
  let tinyPreview = ''
  try {
    const dataUrl = await createTinyPreview(blob)
    if (dataUrl) tinyPreview = await encryptText(encryptionKey, dataUrl)
  } catch {
    tinyPreview = ''
  }

  return {
    ...original,
    thumbUrl: thumb?.url ?? '',
    thumbPublicId: thumb?.publicId ?? '',
    tinyPreview,
  }
}

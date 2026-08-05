import { encryptBlob } from './encryption'
import { createThumbnail } from './imageThumbnail'
import { CLOUDINARY_CLOUD_NAME } from '../config/cloudinary'

async function uploadEncryptedBlob(blob, encryptionKey) {
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
    throw new Error(err?.error?.message ?? `Upload failed (${response.status})`)
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

  return {
    ...original,
    thumbUrl: thumb?.url ?? '',
    thumbPublicId: thumb?.publicId ?? '',
  }
}

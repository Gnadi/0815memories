import { encryptBlob } from './encryption'
import { CLOUDINARY_CLOUD_NAME } from '../config/cloudinary'

/**
 * Encrypt a file/blob and upload it to Cloudinary as a raw resource.
 * Returns { url, publicId } on success.
 */
export async function encryptAndUpload(file, encryptionKey) {
  // 1. Encrypt the file
  const blob = file instanceof Blob ? file : new Blob([file])
  const encryptedBuffer = await encryptBlob(encryptionKey, blob)
  const encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' })

  // 2. Get signed upload credentials for raw resource type
  const signRes = await fetch('/api/cloudinary-sign?resource_type=raw')
  if (!signRes.ok) throw new Error('Failed to get upload signature')
  const { timestamp, signature, folder, apiKey } = await signRes.json()

  // 3. Upload encrypted blob to Cloudinary as raw
  const formData = new FormData()
  formData.append('file', encryptedBlob, 'encrypted.bin')
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

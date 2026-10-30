import { auth, functions } from '../config/firebase'
import { CLOUDINARY_CLOUD_NAME } from '../config/cloudinary'
import { readStored } from './authStorage'

// Thrown when signUpload refuses for a quota; `reason` is 'rate' (too many
// uploads this hour) or 'storage' (the family's space is used up). Matched on
// `code`, like UPLOAD_TOO_LARGE in encryptedUpload.js.
export const UPLOAD_QUOTA = 'upload/quota'

/**
 * Ask the signUpload Cloud Function for permission to upload one file
 * (functions/mediaSigning.js), as the signed-in admin of the family this
 * session is working in.
 *
 * The function picks the file's public_id and records it before answering, so
 * a signature is good for exactly one file. Ask again for every upload.
 *
 * @param {'encrypted'|'public'} [kind]  'public' only for a picture shown
 *   without the family key, such as the login header
 * @returns {Promise<{ apiKey: string, signature: string, resourceType: string, publicId: string, params: Record<string, string|number> }>}
 */
export async function fetchUploadSignature(kind = 'encrypted') {
  if (!auth?.currentUser || !functions) throw new Error('Sign in to upload')
  const familyId = readStored('fh_familyId')
  if (!familyId) throw new Error('Sign in to upload')

  // Loaded when the first upload is signed rather than with the module: every
  // upload path imports this file, and the callable SDK is not needed before.
  const { httpsCallable } = await import('firebase/functions')
  try {
    const { data } = await httpsCallable(functions, 'signUpload')({ familyId, kind })
    return data
  } catch (error) {
    if (error?.code === 'functions/resource-exhausted') {
      const quota = new Error('Upload limit reached')
      quota.code = UPLOAD_QUOTA
      quota.reason = error.details?.reason === 'storage' ? 'storage' : 'rate'
      throw quota
    }
    throw new Error('Failed to get upload signature')
  }
}

/** Where a signed upload is sent. */
export function signedUploadUrl(signed) {
  return `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${signed.resourceType}/upload`
}

/**
 * The form Cloudinary expects for a signed upload: the file, the key, the
 * signature, and exactly the parameters that were signed — one more or one
 * fewer and Cloudinary rejects the signature.
 */
export function signedUploadForm(file, filename, signed) {
  const formData = new FormData()
  if (filename) formData.append('file', file, filename)
  else formData.append('file', file)
  for (const [key, value] of Object.entries(signed.params)) formData.append(key, String(value))
  formData.append('api_key', signed.apiKey)
  formData.append('signature', signed.signature)
  return formData
}

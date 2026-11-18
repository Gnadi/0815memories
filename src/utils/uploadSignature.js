import { auth, functions } from '../config/firebase'
import { appCheckReady } from '../config/appCheck'
import { CLOUDINARY_CLOUD_NAME } from '../config/cloudinary'
import { readStored } from './authStorage'

// Thrown when signUpload refuses for a quota; `reason` is 'rate' (too many
// uploads this hour) or 'storage' (the family's space is used up). Matched on
// `code`, like UPLOAD_TOO_LARGE in encryptedUpload.js.
export const UPLOAD_QUOTA = 'upload/quota'

// The most files signUpload signs in one call (MAX_BATCH in
// functions/mediaSigning.js).
const MAX_BATCH = 20

// Requests waiting for a signature, per family and kind, and whether a call
// for them is under way.
const queues = new Map()

function signingError(error) {
  if (error?.code === 'functions/resource-exhausted') {
    const quota = new Error('Upload limit reached')
    quota.code = UPLOAD_QUOTA
    quota.reason = error.details?.reason === 'storage' ? 'storage' : 'rate'
    return quota
  }
  return new Error('Failed to get upload signature')
}

// One call at a time per family and kind, carrying every request that came in
// meanwhile. Each call is a transaction on the admin's rate and the family's
// usage, documents every upload shares; a choice of ten photos used to be
// twenty calls queueing on them, and is now one.
async function drain(key, familyId, kind) {
  const queue = queues.get(key)
  try {
    // Loaded when the first upload is signed rather than with the module: every
    // upload path imports this file, and the callable SDK is not needed before.
    const [{ httpsCallable }] = await Promise.all([import('firebase/functions'), appCheckReady()])
    const sign = httpsCallable(functions, 'signUpload')
    while (queue.waiting.length) {
      const batch = queue.waiting.splice(0, MAX_BATCH)
      try {
        const { data } = await sign({ familyId, kind, count: batch.length })
        // A function from before batches answers with one signature.
        const uploads = Array.isArray(data?.uploads) ? data.uploads : [data]
        if (!uploads.length || !uploads[0]) throw new Error('No signature')
        batch.slice(0, uploads.length).forEach((request, i) => request.resolve(uploads[i]))
        // Fewer than asked for means a limit left room for only these; the
        // next call refuses the rest with the reason, or signs them if it was
        // a function from before batches.
        queue.waiting.unshift(...batch.slice(uploads.length))
      } catch (error) {
        const reason = signingError(error)
        batch.forEach((request) => request.reject(reason))
      }
    }
  } catch (error) {
    const reason = signingError(error)
    queue.waiting.splice(0).forEach((request) => request.reject(reason))
  } finally {
    queues.delete(key)
  }
}

/**
 * Ask the signUpload Cloud Function for permission to upload one file
 * (functions/mediaSigning.js), as the signed-in admin of the family this
 * session is working in.
 *
 * The function picks the file's public_id and records it before answering, so
 * a signature is good for exactly one file. Ask again for every upload.
 * Requests made together are signed in one call.
 *
 * @param {'encrypted'|'public'} [kind]  'public' only for a picture shown
 *   without the family key, such as the login header
 * @returns {Promise<{ apiKey: string, signature: string, resourceType: string, publicId: string, params: Record<string, string|number> }>}
 */
export async function fetchUploadSignature(kind = 'encrypted') {
  if (!auth?.currentUser || !functions) throw new Error('Sign in to upload')
  const familyId = readStored('fh_familyId')
  if (!familyId) throw new Error('Sign in to upload')

  const key = `${familyId}/${kind}`
  return new Promise((resolve, reject) => {
    let queue = queues.get(key)
    if (!queue) {
      queue = { waiting: [] }
      queues.set(key, queue)
      // A task later rather than now, so the files of one choice, which ask in
      // the same task, go in the same call.
      setTimeout(() => drain(key, familyId, kind), 0)
    }
    queue.waiting.push({ resolve, reject })
  })
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

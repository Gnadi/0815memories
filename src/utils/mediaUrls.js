// The family's photos, videos and voice notes are Cloudinary files, named in
// their documents by URL. The trash and the deletion requests list the ones a
// document names, for the purge function to delete (functions/purge.js).
const MEDIA_URL = /^https:\/\/res\.cloudinary\.com\//

/** Every Cloudinary file a (decrypted) document names, wherever in it. */
export function mediaIn(value, found = new Set()) {
  if (typeof value === 'string') {
    if (MEDIA_URL.test(value)) found.add(value)
  } else if (Array.isArray(value)) {
    for (const item of value) mediaIn(item, found)
  } else if (value && typeof value === 'object' && !(value instanceof Date)) {
    for (const item of Object.values(value)) mediaIn(item, found)
  }
  return found
}

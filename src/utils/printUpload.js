/**
 * Putting a print file where Peecho can fetch it.
 *
 * Peecho's checkout takes the book as a URL and downloads it when the order
 * goes into production — from its own servers, long after this page may have
 * closed, and without any Kaydo login. So the file cannot be Cloudinary
 * ciphertext like every other upload: it is the one thing Kaydo stores
 * unencrypted on purpose, and the order dialog says so before it is made.
 *
 * It goes to Firebase Storage rather than Cloudinary because Cloudinary's free
 * plan caps a raw file at 10 MB, and a print-resolution book is tens of MB.
 * The address handed to Peecho is a Storage download URL: it works for anyone
 * holding it and for no one else, since its token is unguessable and nothing
 * lists the bucket. storage.rules keeps the folder to the family's admins and
 * makes each file write-once, so a URL already handed to Peecho cannot be made
 * to point at different content. A folder must also have been reserved
 * (reservePrintUpload, a limited number per family). The purgePrintFiles Cloud
 * Function deletes every file after PRINT_FILE_RETENTION_DAYS.
 *
 *   printFiles/{familyId}/{printId}/book.pdf
 *   printFiles/{familyId}/{printId}/cover.jpg
 *
 * A birth sky poster ordered as a wall print goes the same way, under the same
 * names: book.pdf is then its one page and cover.jpg its thumbnail.
 */
import { getStorageInstance } from '../config/firebase'
import { reservePrintUpload } from '../services/printReservation'

export function printFilePaths(familyId, printId) {
  const folder = `printFiles/${familyId}/${printId}`
  return { pdf: `${folder}/book.pdf`, thumbnail: `${folder}/cover.jpg` }
}

/**
 * Upload a rendered print file and its cover picture.
 *
 * `onProgress(fraction)` follows the PDF, which is nearly all of the bytes.
 * When `isCancelled()` turns true the upload is abandoned and whatever landed
 * already is deleted. Resolves to null when cancelled.
 *
 * @returns {Promise<{ printId: string, pdfUrl: string, thumbnailUrl: string|null } | null>}
 */
export async function uploadPrintFile({ familyId, pdf, thumbnail, onProgress = () => {}, isCancelled = () => false }) {
  if (!familyId) throw new Error('No family to store the print file for')
  const storage = await getStorageInstance()
  if (!storage) throw new Error('Firebase Storage is not configured')
  const { ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } = await import('firebase/storage')

  // The server picks the folder: storage.rules refuse any other. Asked for
  // last, so the hour it is good for starts when the upload does.
  const { printId } = await reservePrintUpload(familyId)
  const paths = printFilePaths(familyId, printId)
  const pdfRef = ref(storage, paths.pdf)
  const thumbnailRef = ref(storage, paths.thumbnail)
  const uploaded = []

  const discard = () => Promise.allSettled(uploaded.map((r) => deleteObject(r)))

  try {
    let thumbnailUrl = null
    if (thumbnail) {
      await uploadBytes(thumbnailRef, thumbnail, { contentType: 'image/jpeg' })
      uploaded.push(thumbnailRef)
      thumbnailUrl = await getDownloadURL(thumbnailRef)
    }
    if (isCancelled()) {
      await discard()
      return null
    }

    const task = uploadBytesResumable(pdfRef, pdf, { contentType: 'application/pdf' })
    const finished = await new Promise((resolve, reject) => {
      task.on(
        'state_changed',
        (snapshot) => {
          if (isCancelled()) {
            task.cancel()
            return
          }
          if (snapshot.totalBytes > 0) onProgress(snapshot.bytesTransferred / snapshot.totalBytes)
        },
        (error) => (error?.code === 'storage/canceled' ? resolve(false) : reject(error)),
        () => resolve(true),
      )
    })
    if (!finished) {
      await discard()
      return null
    }
    uploaded.push(pdfRef)
    onProgress(1)

    const pdfUrl = await getDownloadURL(pdfRef)
    return { printId, pdfUrl, thumbnailUrl }
  } catch (error) {
    await discard()
    throw error
  }
}

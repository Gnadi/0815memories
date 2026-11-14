/**
 * Reading the family's encrypted documents: the two ways every service in this
 * folder does it.
 */
import { doc, getDoc, onSnapshot } from '../config/firestore'
import { db } from '../config/firebase'

/**
 * onSnapshot for encrypted documents. `decrypt` gets each snapshot's documents
 * as `{ id, ...data }` and returns what `onData` is handed.
 *
 * Decrypting is asynchronous, so a later snapshot can be ready before an
 * earlier one — a re-emit whose fields are cached beats a cold first load. Only
 * the newest snapshot is delivered, and nothing once unsubscribed: otherwise a
 * slow decrypt could put an older list, or the previous family's, back on
 * screen. The moments row found this out first; every list has it now.
 */
export function subscribeDecrypted(source, decrypt, onData, onError) {
  let latest = 0
  let active = true
  const unsubscribe = onSnapshot(
    source,
    async (snapshot) => {
      const seq = ++latest
      try {
        const result = await decrypt(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })))
        if (active && seq === latest) onData(result)
      } catch (err) {
        if (active && seq === latest) onError?.(err)
      }
    },
    (err) => {
      if (active) onError?.(err)
    },
  )
  return () => {
    active = false
    unsubscribe()
  }
}

/**
 * subscribeDecrypted for a single document: `onData` gets it decrypted, or null
 * while it does not exist, and again only the newest snapshot's.
 */
export function subscribeDecryptedDocument(ref, decrypt, onData, onError) {
  let latest = 0
  let active = true
  const unsubscribe = onSnapshot(
    ref,
    async (snapshot) => {
      const seq = ++latest
      try {
        const result = snapshot.exists() ? await decrypt({ id: snapshot.id, ...snapshot.data() }) : null
        if (active && seq === latest) onData(result)
      } catch (err) {
        if (active && seq === latest) onError?.(err)
      }
    },
    (err) => {
      if (active) onError?.(err)
    },
  )
  return () => {
    active = false
    unsubscribe()
  }
}

/**
 * One of the family's documents, decrypted — or null when it does not exist or
 * belongs to another family. The rules refuse to read another family's
 * documents anyway; the pages checked it themselves before this, and still do
 * through here.
 */
export async function getFamilyDocument(collectionName, id, familyId, decrypt) {
  const snap = await getDoc(doc(db, collectionName, id))
  if (!snap.exists()) return null
  const data = { id: snap.id, ...snap.data() }
  if (data.familyId !== familyId) return null
  return decrypt(data)
}

import { useCallback } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../config/firebase'
import { buildFeedbackDocument } from '../constants/feedback'

/**
 * Sending feedback about the app itself.
 *
 * Write-only by design: `firestore.rules` lets a family member create a
 * document here and nothing else — no read, no update, no delete. Feedback is
 * addressed to whoever runs the app, and a collection the client can read back
 * would hand every family's notes to every other family.
 *
 * Deliberately *not* encrypted with the family key, unlike memories, journals
 * and the rest. The family key exists so the server cannot read the family's
 * own content; feedback is the one thing written *for* the server to read, and
 * encrypting it would turn every bug report into ciphertext nobody can act on.
 * The form says so on screen rather than leaving people to assume otherwise.
 */
export function useFeedbackWriter(familyId, { uid = null, role = null } = {}) {
  const submitFeedback = useCallback(async (input) => {
    if (!db) throw new Error('Firebase not configured')
    if (!familyId) throw new Error('No family in session')

    const built = buildFeedbackDocument(input)
    if (!built.ok) {
      const err = new Error(built.error)
      // The message is a translation key in the `feedback` namespace; the modal
      // renders it instead of the generic "could not send" line.
      err.translationKey = built.error
      throw err
    }

    await addDoc(collection(db, 'feedback'), {
      ...built.value,
      familyId,
      uid,
      role,
      // Triage state for whoever reads the collection. The rules pin it to
      // 'new' on create, so it can only ever be moved on server-side.
      status: 'new',
      createdAt: serverTimestamp(),
    })
  }, [familyId, uid, role])

  return { submitFeedback }
}

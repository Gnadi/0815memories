import { useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { encryptFamilyMoments } from '../../services/momentEncryption'
import { devError } from '../../utils/devLog'

// Families whose moments this tab has already looked at: the counts that say
// there is nothing to do cost two reads, and a tab only needs to pay them once.
const checked = new Set()

/**
 * Encrypts the family's moments from before their text was encrypted
 * (services/momentEncryption.js), once per tab, in the background. Rendered
 * for admins only (App.jsx), since only they can write moments. Shows nothing:
 * the moments look the same before and after.
 */
export default function MomentTextEncryption() {
  const { familyId, encryptionKey, isAdmin, isDemo } = useAuth()

  useEffect(() => {
    if (!isAdmin || isDemo || !familyId || !encryptionKey || checked.has(familyId)) return
    let stopped = false
    let done = false
    checked.add(familyId)
    encryptFamilyMoments(familyId, encryptionKey, { shouldStop: () => stopped })
      .then(({ failed }) => {
        done = true
        // Moments it could not encrypt are left for the next tab.
        if (failed > 0) checked.delete(familyId)
      })
      .catch((err) => {
        done = true
        checked.delete(familyId)
        devError('Could not encrypt the family\'s moments', err)
      })
    return () => {
      stopped = true
      // A run cut short is left to the next mount, which StrictMode makes at
      // once in development. Each moment is its own transaction, so two runs
      // overlapping for a moment cannot both write one.
      if (!done) checked.delete(familyId)
    }
  }, [familyId, encryptionKey, isAdmin, isDemo])

  return null
}

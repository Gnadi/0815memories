import { useState, useEffect } from 'react'
import { db } from '../config/firebase'
import { subscribeTrash } from '../services/trash'

/** The family's trash, one item per group, newest first. */
export function useTrash(familyId, encryptionKey) {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!familyId || !db) {
      setLoading(false)
      return
    }
    return subscribeTrash(familyId, encryptionKey, (list) => {
      setGroups(list)
      setError(null)
      setLoading(false)
    }, (err) => {
      // An empty trash and one that could not be read must not look the same:
      // the second hides things that are about to be deleted for good.
      setError(err)
      setLoading(false)
    })
  }, [familyId, encryptionKey])

  return { groups, loading, error }
}

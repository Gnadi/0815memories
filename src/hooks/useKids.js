import { useState, useEffect } from 'react'
import { db } from '../config/firebase'
import { addKid, subscribeKids, updateKid } from '../services/kids'
import { moveToTrash } from '../services/trash'

export function useKids(familyId, encryptionKey) {
  const [kids, setKids] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId || !db) {
      setLoading(false)
      return
    }

    return subscribeKids(familyId, encryptionKey, (list) => {
      setKids(list)
      setLoading(false)
    }, (err) => {
      if (import.meta.env.DEV) console.error('useKids snapshot error:', err)
      setLoading(false)
    })
  }, [familyId, encryptionKey])

  return {
    kids,
    loading,
    addKid: (kid) => addKid(familyId, encryptionKey, kid),
    updateKid: (id, updates) => updateKid(encryptionKey, id, updates),
    deleteKid: (id) => moveToTrash(encryptionKey, 'children', id),
  }
}

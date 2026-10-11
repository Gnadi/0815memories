import { useState, useEffect } from 'react'
import { db } from '../config/firebase'
import {
  addJournal,
  subscribeAllJournals,
  subscribeJournals,
  updateJournal,
} from '../services/journals'
import { moveToTrash } from '../services/trash'

export function useJournals(familyId, childId, encryptionKey) {
  const [journals, setJournals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId || !childId || !db) {
      setLoading(false)
      return
    }

    return subscribeJournals(familyId, childId, encryptionKey, (list) => {
      setJournals(list)
      setLoading(false)
    }, (err) => {
      if (import.meta.env.DEV) console.error('useJournals snapshot error:', err)
      setLoading(false)
    })
  }, [familyId, childId, encryptionKey])

  return {
    journals,
    loading,
    addJournal: (entry) => addJournal(familyId, childId, encryptionKey, entry),
    updateJournal: (id, updates) => updateJournal(encryptionKey, id, updates),
    deleteJournal: (id) => moveToTrash(encryptionKey, 'journals', id),
  }
}

export function useAllJournals(familyId, encryptionKey) {
  const [journals, setJournals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId || !db) {
      setLoading(false)
      return
    }

    return subscribeAllJournals(familyId, encryptionKey, (list) => {
      setJournals(list)
      setLoading(false)
    }, (err) => {
      if (import.meta.env.DEV) console.error('useAllJournals snapshot error:', err)
      setLoading(false)
    })
  }, [familyId, encryptionKey])

  return { journals, loading }
}

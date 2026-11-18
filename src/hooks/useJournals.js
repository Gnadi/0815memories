import { useState, useEffect } from 'react'
import { db } from '../config/firebase'
import {
  addJournal,
  deleteJournal,
  getJournal,
  getJournalSummary,
  subscribeJournals,
  updateJournal,
} from '../services/journals'
import { devError } from '../utils/devLog'
import { entryDate } from '../utils/journalContent'

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
    deleteJournal: (id) => deleteJournal(id),
  }
}

/** Writing one child's entries, without reading them. */
export function useJournalWriter(familyId, childId, encryptionKey) {
  return {
    addJournal: (entry) => addJournal(familyId, childId, encryptionKey, entry),
    updateJournal: (id, updates) => updateJournal(encryptionKey, id, updates),
    deleteJournal: (id) => deleteJournal(id),
  }
}

/**
 * One entry, read once. The detail and edit pages show a single entry and
 * used to listen to all of the child's, which grows by one a day.
 */
export function useJournal(familyId, childId, entryId, encryptionKey) {
  const [state, setState] = useState({ for: null, entry: null })
  const target = familyId && childId && entryId ? `${familyId}/${childId}/${entryId}` : null

  useEffect(() => {
    if (!target || !db) return
    let cancelled = false
    getJournal(familyId, childId, encryptionKey, entryId)
      .then((entry) => { if (!cancelled) setState({ for: target, entry }) })
      .catch((err) => {
        devError('Failed to load journal entry:', err)
        if (!cancelled) setState({ for: target, entry: null })
      })
    return () => { cancelled = true }
  }, [target, familyId, childId, entryId, encryptionKey])

  const loading = !!target && !!db && state.for !== target
  return { entry: state.for === target ? state.entry : null, loading }
}

/**
 * Per child, how many entries and when the latest was: { [childId]: { count,
 * lastEntryDate } }. Counted on the server; nothing is decrypted.
 */
export function useJournalSummaries(familyId, childIds) {
  const [summaries, setSummaries] = useState({})
  const key = childIds.join(',')

  useEffect(() => {
    if (!familyId || !db || !key) return
    let cancelled = false
    Promise.all(key.split(',').map(async (childId) => {
      try {
        const { count, latest } = await getJournalSummary(familyId, childId)
        return [childId, { count, last: latest ? entryDate(latest) : null }]
      } catch (err) {
        devError('Failed to count journal entries:', err)
        return [childId, null]
      }
    })).then((pairs) => {
      if (!cancelled) setSummaries(Object.fromEntries(pairs.filter(([, summary]) => summary)))
    })
    return () => { cancelled = true }
  }, [familyId, key])

  return summaries
}

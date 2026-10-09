import { useState, useEffect } from 'react'
import { db } from '../config/firebase'
import {
  addHighlight,
  deleteHighlight,
  subscribeHighlights,
  updateHighlight,
} from '../services/highlights'

export function useHighlightWriter(familyId, encryptionKey) {
  return {
    addHighlight: (data) => addHighlight(familyId, encryptionKey, data),
    updateHighlight: (id, data) => updateHighlight(encryptionKey, id, data),
    deleteHighlight: (id) => deleteHighlight(id),
  }
}

/**
 * Live list of the family's highlight videos, newest first.
 */
export function useHighlights(familyId, encryptionKey, { withDoc = false } = {}) {
  const [highlights, setHighlights] = useState([])
  // Which family the current list belongs to. Tracking it (rather than a
  // `loading` flag flipped inside the effect) means no synchronous setState in
  // an effect body, and a family switch still reads as "loading" until its own
  // first snapshot lands.
  const [loadedFor, setLoadedFor] = useState(null)

  useEffect(() => {
    if (!familyId || !db) return

    return subscribeHighlights(familyId, encryptionKey, { withDoc }, (list) => {
      setHighlights(list)
      setLoadedFor(familyId)
    }, (error) => {
      if (import.meta.env.DEV) console.error('Failed to load highlights:', error)
      setLoadedFor(familyId)
    })
  }, [familyId, encryptionKey, withDoc])

  const writer = useHighlightWriter(familyId, encryptionKey)
  const loading = !!familyId && !!db && loadedFor !== familyId

  return { highlights, loading, ...writer }
}

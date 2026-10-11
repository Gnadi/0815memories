import { useState, useEffect } from 'react'
import { db } from '../config/firebase'
import {
  addScrapbook,
  subscribeScrapbooks,
  updateScrapbook,
} from '../services/scrapbooks'
import { moveToTrash } from '../services/trash'

/**
 * Write operations only — no Firestore subscription. See useMemoryWriter for
 * why this is split out.
 */
export function useScrapbookWriter(familyId, encryptionKey) {
  return {
    addScrapbook: (data) => addScrapbook(familyId, encryptionKey, data),
    updateScrapbook: (id, data) => updateScrapbook(encryptionKey, id, data),
    deleteScrapbook: (id) => moveToTrash(encryptionKey, 'scrapbooks', id),
  }
}

/**
 * Live list of the family's scrapbooks. `pages` stays encrypted unless asked
 * for — the overview only needs `title` and `coverImageUrl`, and the editor
 * loads its one book itself.
 */
export function useScrapbooks(familyId, encryptionKey, { withPages = false } = {}) {
  const [scrapbooks, setScrapbooks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId || !db) {
      setLoading(false)
      return
    }

    return subscribeScrapbooks(familyId, encryptionKey, { withPages }, (list) => {
      setScrapbooks(list)
      setLoading(false)
    }, (error) => {
      if (import.meta.env.DEV) console.error('Failed to load scrapbooks:', error)
      setLoading(false)
    })
  }, [familyId, encryptionKey, withPages])

  const writer = useScrapbookWriter(familyId, encryptionKey)

  return { scrapbooks, loading, ...writer }
}

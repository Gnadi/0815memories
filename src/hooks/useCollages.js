import { useState, useEffect } from 'react'
import { db } from '../config/firebase'
import {
  addCollage,
  deleteCollage,
  subscribeCollages,
  updateCollage,
} from '../services/collages'

/**
 * Write operations only — no Firestore subscription. The editor loads its one
 * collage itself, so subscribing there would live-decrypt every other collage.
 */
export function useCollageWriter(familyId, encryptionKey) {
  return {
    addCollage: (data) => addCollage(familyId, encryptionKey, data),
    updateCollage: (id, data) => updateCollage(encryptionKey, id, data),
    deleteCollage: (id) => deleteCollage(id),
  }
}

/**
 * Live list of the family's collages, newest first.
 */
export function useCollages(familyId, encryptionKey, { withDoc = false } = {}) {
  const [collages, setCollages] = useState([])
  // Which family the current list belongs to. Tracking it (rather than a
  // `loading` flag flipped inside the effect) means no synchronous setState in
  // an effect body, and a family switch still reads as "loading" until its own
  // first snapshot lands.
  const [loadedFor, setLoadedFor] = useState(null)

  useEffect(() => {
    if (!familyId || !db) return

    return subscribeCollages(familyId, encryptionKey, { withDoc }, (list) => {
      setCollages(list)
      setLoadedFor(familyId)
    }, (error) => {
      if (import.meta.env.DEV) console.error('Failed to load collages:', error)
      setLoadedFor(familyId)
    })
  }, [familyId, encryptionKey, withDoc])

  const writer = useCollageWriter(familyId, encryptionKey)
  const loading = !!familyId && !!db && loadedFor !== familyId

  return { collages, loading, ...writer }
}

import { useState, useEffect } from 'react'
import { db } from '../config/firebase'
import {
  addMemory,
  convertMemoryToMoment,
  convertMomentToMemory,
  subscribeMemories,
  updateMemory,
} from '../services/memories'
import { addMoment, subscribeMoments, updateMoment } from '../services/moments'
import { moveToTrash } from '../services/trash'

const DEFAULT_MEMORIES_LIMIT = 50
const DEFAULT_MOMENTS_LIMIT = 10

/**
 * Write operations only — no Firestore subscription.
 *
 * Components that just need a "create memory" action used to call
 * useMemories() for it, which opened a second 50-document listener and
 * re-decrypted six fields per memory on every snapshot, in parallel with the
 * page's own listener.
 */
export function useMemoryWriter(familyId, encryptionKey) {
  return {
    addMemory: (memory) => addMemory(familyId, encryptionKey, memory),
    updateMemory: (id, updates) => updateMemory(encryptionKey, id, updates),
    deleteMemory: (id) => moveToTrash(encryptionKey, 'memories', id),
  }
}

export function useMemories(familyId, encryptionKey, pageSize = DEFAULT_MEMORIES_LIMIT) {
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!familyId || !db) {
      setLoading(false)
      return
    }

    return subscribeMemories(familyId, encryptionKey, { pageSize }, (list) => {
      setMemories(list)
      setError(null)
      setLoading(false)
    }, (err) => {
      setError(err)
      setLoading(false)
    })
  }, [familyId, encryptionKey, pageSize])

  const writer = useMemoryWriter(familyId, encryptionKey)

  const featuredMemory = memories.find((m) => m.featured)

  return { memories, featuredMemory, loading, error, ...writer }
}

/**
 * The moments subscription, shared by the home row and the full grid — they
 * differ only in how many documents they ask for.
 */
function useMomentsSubscription(familyId, encryptionKey, pageSize) {
  const [moments, setMoments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!familyId || !db) {
      setLoading(false)
      return
    }

    return subscribeMoments(familyId, encryptionKey, { pageSize }, (list) => {
      setMoments(list)
      setError(null)
      setLoading(false)
    }, (err) => {
      setError(err)
      setLoading(false)
    })
  }, [familyId, encryptionKey, pageSize])

  return { moments, loading, error }
}

/**
 * Moment writes without a subscription — the counterpart of useMemoryWriter,
 * for surfaces that can post a moment without showing the moments row.
 */
export function useMomentWriter(familyId) {
  return { addMoment: (moment) => addMoment(familyId, moment) }
}

/**
 * Turns a memory into a moment and back — see services/memories.js.
 */
export function useEntryConverter(familyId, encryptionKey) {
  return {
    convertMemoryToMoment: (memoryId, moment, date) => convertMemoryToMoment(familyId, memoryId, moment, date),
    convertMomentToMemory: (momentId, memory) => convertMomentToMemory(familyId, encryptionKey, momentId, memory),
  }
}

export function useMoments(familyId, encryptionKey, pageSize = DEFAULT_MOMENTS_LIMIT) {
  const { moments, loading, error } = useMomentsSubscription(familyId, encryptionKey, pageSize)
  const { addMoment } = useMomentWriter(familyId)

  const deleteMoment = (id) => moveToTrash(encryptionKey, 'moments', id)
  return { moments, loading, error, addMoment, updateMoment, deleteMoment }
}

const DEFAULT_ALL_MOMENTS_LIMIT = 200

export function useAllMoments(familyId, encryptionKey, pageSize = DEFAULT_ALL_MOMENTS_LIMIT) {
  const { moments, loading, error } = useMomentsSubscription(familyId, encryptionKey, pageSize)

  const deleteMoment = (id) => moveToTrash(encryptionKey, 'moments', id)
  return { moments, loading, error, updateMoment, deleteMoment }
}

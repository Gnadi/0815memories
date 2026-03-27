import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

/**
 * Real-time listener for all memories, ordered by date descending.
 */
export function useMemories() {
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const q = query(collection(db, 'memories'), orderBy('date', 'desc'))
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setMemories(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => {
        console.error('useMemories error:', err)
        setError(err)
        setLoading(false)
      }
    )
    return unsubscribe
  }, [])

  return { memories, loading, error }
}

/**
 * Fetch a single memory by ID (one-time read).
 */
export function useMemory(id) {
  const [memory, setMemory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id) return
    getDoc(doc(db, 'memories', id))
      .then(snap => {
        if (snap.exists()) setMemory({ id: snap.id, ...snap.data() })
        else setError(new Error('Memory not found'))
        setLoading(false)
      })
      .catch(err => {
        setError(err)
        setLoading(false)
      })
  }, [id])

  return { memory, loading, error }
}

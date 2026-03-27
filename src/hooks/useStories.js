import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase'

/**
 * Real-time listener for stories (daily moments), ordered by date descending.
 */
export function useStories() {
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'stories'), orderBy('date', 'desc'))
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setStories(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setLoading(false)
      },
      (err) => {
        console.error('useStories error:', err)
        setLoading(false)
      }
    )
    return unsubscribe
  }, [])

  return { stories, loading }
}

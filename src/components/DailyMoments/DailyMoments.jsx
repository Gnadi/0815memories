import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../contexts/AuthContext'
import { format } from 'date-fns'
import { HiPlus } from 'react-icons/hi'
import styles from './DailyMoments.module.css'

export default function DailyMoments() {
  const [moments, setMoments] = useState([])
  const { isAdmin } = useAuth()

  useEffect(() => {
    async function fetchMoments() {
      try {
        const q = query(
          collection(db, 'memories'),
          where('type', '==', 'moment'),
          orderBy('createdAt', 'desc'),
          limit(10)
        )
        const snapshot = await getDocs(q)
        setMoments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      } catch (err) {
        console.error('Error fetching moments:', err)
      }
    }
    fetchMoments()
  }, [])

  function formatLabel(moment) {
    if (!moment.date) return ''
    try {
      const d = moment.date.toDate ? moment.date.toDate() : new Date(moment.date)
      const now = new Date()
      const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24))
      if (diff === 0) return 'Today'
      if (diff === 1) return 'Yesterday'
      return format(d, 'MMM d')
    } catch {
      return ''
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Daily Moments</h2>
        <a href="/album" className={styles.viewAll}>View All</a>
      </div>

      <div className={styles.scrollRow}>
        {isAdmin && (
          <div className={styles.momentItem}>
            <button className={styles.addButton} aria-label="Add moment">
              <HiPlus />
            </button>
            <span className={styles.label}>Add</span>
          </div>
        )}

        {moments.map((moment) => (
          <div key={moment.id} className={styles.momentItem}>
            <div className={styles.ring}>
              <div className={styles.ringInner}>
                <img
                  src={moment.thumbnailUrl || moment.imageUrl}
                  alt={moment.title || 'Moment'}
                />
              </div>
            </div>
            <span className={styles.label}>{formatLabel(moment)}</span>
          </div>
        ))}

        {moments.length === 0 && !isAdmin && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            No moments yet
          </p>
        )}
      </div>
    </div>
  )
}

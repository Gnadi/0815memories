import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db, isConfigured } from '../firebase'
import { format } from 'date-fns'
import { HiArrowLeft, HiShare, HiDotsVertical, HiCalendar, HiLocationMarker } from 'react-icons/hi'
import Layout from '../components/Layout/Layout'
import styles from './MemoryDetailPage.module.css'

export default function MemoryDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [memory, setMemory] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMemory() {
      if (!db) { setLoading(false); return }
      try {
        const docRef = doc(db, 'memories', id)
        const docSnap = await getDoc(docRef)
        if (docSnap.exists()) {
          setMemory({ id: docSnap.id, ...docSnap.data() })
        }
      } catch (err) {
        console.error('Error fetching memory:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchMemory()
  }, [id])

  if (loading) {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--color-text-muted)' }}>
          Loading...
        </div>
      </Layout>
    )
  }

  if (!memory) {
    return (
      <Layout>
        <div className={styles.notFound}>
          <p>Memory not found</p>
          <button onClick={() => navigate('/home')} className={styles.backButton}>
            <HiArrowLeft /> Back to Home
          </button>
        </div>
      </Layout>
    )
  }

  const memoryDate = memory.date?.toDate ? memory.date.toDate() : new Date(memory.date)

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}>
          <button onClick={() => navigate(-1)} className={styles.backButton}>
            <HiArrowLeft /> Family Hearth
          </button>
          <div className={styles.headerActions}>
            <button aria-label="Share"><HiShare /></button>
            <button aria-label="More"><HiDotsVertical /></button>
          </div>
        </div>

        <div className={styles.hero}>
          <img
            src={memory.imageUrl}
            alt={memory.title}
            className={styles.heroImage}
          />
          {memory.category && (
            <span className={styles.heroCategory}>{memory.category}</span>
          )}
        </div>

        <div className={styles.meta}>
          {memory.date && (
            <span className={styles.metaTag}>
              <HiCalendar /> {format(memoryDate, 'MMMM d, yyyy')}
            </span>
          )}
          {memory.location && (
            <span className={styles.metaTag}>
              <HiLocationMarker /> {memory.location}
            </span>
          )}
        </div>

        <h1 className={styles.title}>{memory.title}</h1>

        {memory.quote && (
          <blockquote className={styles.blockquote}>
            "{memory.quote}"
          </blockquote>
        )}

        {memory.story && (
          <div className={styles.story}>
            {memory.story.split('\n\n').map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db, isConfigured } from '../firebase'
import Layout from '../components/Layout/Layout'
import DailyMoments from '../components/DailyMoments/DailyMoments'
import MemoryCard, { HeroCard } from '../components/MemoryCard/MemoryCard'
import FamilyAlbumGlimpse from '../components/FamilyAlbum/FamilyAlbumGlimpse'
import styles from './HomePage.module.css'

export default function HomePage() {
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMemories() {
      if (!db) { setLoading(false); return }
      try {
        const q = query(
          collection(db, 'memories'),
          where('type', '==', 'memory'),
          orderBy('createdAt', 'desc')
        )
        const snapshot = await getDocs(q)
        setMemories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      } catch (err) {
        console.error('Error fetching memories:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchMemories()
  }, [])

  const heroMemory = memories[0]
  const feedMemories = memories.slice(1)

  return (
    <Layout>
      <div className={styles.page}>
        <DailyMoments />

        {loading && (
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '40px 0' }}>
            Loading memories...
          </p>
        )}

        {!loading && heroMemory && (
          <HeroCard memory={heroMemory} />
        )}

        {!loading && feedMemories.length > 0 && (
          <div className={styles.memoryFeed}>
            {feedMemories.map((memory) => (
              <MemoryCard key={memory.id} memory={memory} />
            ))}
          </div>
        )}

        {!loading && memories.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
            <p style={{ fontSize: '2rem', marginBottom: '12px' }}>🏠</p>
            <p>No memories yet. Ask your admin to post the first one!</p>
          </div>
        )}

        <FamilyAlbumGlimpse />
      </div>
    </Layout>
  )
}

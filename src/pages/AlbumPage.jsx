import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import Layout from '../components/Layout/Layout'
import styles from './AlbumPage.module.css'

export default function AlbumPage() {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchPhotos() {
      try {
        const q = query(
          collection(db, 'memories'),
          orderBy('createdAt', 'desc')
        )
        const snapshot = await getDocs(q)
        setPhotos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      } catch (err) {
        console.error('Error fetching photos:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchPhotos()
  }, [])

  return (
    <Layout>
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Our Memories</h1>
          <p className={styles.subtitle}>All the moments we've shared together</p>
        </div>

        {loading && (
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '40px 0' }}>
            Loading...
          </p>
        )}

        {!loading && photos.length > 0 && (
          <div className={styles.grid}>
            {photos.map((photo) => (
              <div
                key={photo.id}
                className={styles.gridItem}
                onClick={() => navigate(`/memory/${photo.id}`)}
              >
                <img
                  src={photo.thumbnailUrl || photo.imageUrl}
                  alt={photo.title || 'Memory'}
                />
                {photo.title && (
                  <div className={styles.gridOverlay}>{photo.title}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && photos.length === 0 && (
          <div className={styles.empty}>
            <p style={{ fontSize: '2rem', marginBottom: '12px' }}>📷</p>
            <p>No photos in the album yet.</p>
          </div>
        )}
      </div>
    </Layout>
  )
}

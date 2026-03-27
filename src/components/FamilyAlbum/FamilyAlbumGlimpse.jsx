import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import styles from './FamilyAlbumGlimpse.module.css'

export default function FamilyAlbumGlimpse() {
  const [photos, setPhotos] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    async function fetchPhotos() {
      try {
        const q = query(
          collection(db, 'memories'),
          orderBy('createdAt', 'desc'),
          limit(5)
        )
        const snapshot = await getDocs(q)
        setPhotos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
      } catch (err) {
        console.error('Error fetching album photos:', err)
      }
    }
    fetchPhotos()
  }, [])

  if (photos.length === 0) return null

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Family Album Glimpse</h2>
      <div className={styles.grid}>
        {photos.map((photo) => (
          <div
            key={photo.id}
            className={styles.gridItem}
            onClick={() => navigate(`/memory/${photo.id}`)}
          >
            <img
              src={photo.thumbnailUrl || photo.imageUrl}
              alt={photo.title || 'Family photo'}
            />
            {photo.category && (
              <span className={styles.gridLabel}>{photo.category}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

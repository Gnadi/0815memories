import { useNavigate } from 'react-router-dom'
import { format, formatDistanceToNow } from 'date-fns'
import { HiDotsHorizontal } from 'react-icons/hi'
import styles from './MemoryCard.module.css'

function formatDate(date) {
  if (!date) return ''
  try {
    const d = date.toDate ? date.toDate() : new Date(date)
    const now = new Date()
    const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Yesterday'
    return format(d, 'MMMM d, yyyy')
  } catch {
    return ''
  }
}

export function HeroCard({ memory }) {
  const navigate = useNavigate()
  const d = memory.date?.toDate ? memory.date.toDate() : new Date(memory.date)

  return (
    <div
      className={styles.heroCard}
      onClick={() => navigate(`/memory/${memory.id}`)}
    >
      <img
        src={memory.imageUrl}
        alt={memory.title}
        className={styles.heroImage}
      />
      <div className={styles.heroOverlay}>
        <div>
          {memory.category && (
            <span className={styles.heroTag}>{memory.category}</span>
          )}
          <span className={styles.heroTime}>
            {formatDistanceToNow(d, { addSuffix: true })}
          </span>
        </div>
        <h3 className={styles.heroTitle}>{memory.title}</h3>
        {memory.quote && (
          <p className={styles.heroSubtitle}>{memory.quote}</p>
        )}
      </div>
    </div>
  )
}

export default function MemoryCard({ memory }) {
  const navigate = useNavigate()

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.date}>{formatDate(memory.date)}</span>
        <button className={styles.moreButton} aria-label="More options">
          <HiDotsHorizontal />
        </button>
      </div>

      {memory.quote && (
        <div className={styles.body}>
          <p className={styles.quote}>"{memory.quote}"</p>
        </div>
      )}

      {memory.imageUrl && (
        <img
          src={memory.imageUrl}
          alt={memory.title || 'Memory'}
          className={`${styles.image} ${memory.quote ? styles.imageRounded : ''}`}
          onClick={() => navigate(`/memory/${memory.id}`)}
        />
      )}

      {memory.title && !memory.quote && (
        <div className={styles.body}>
          <p className={styles.quote}>{memory.title}</p>
        </div>
      )}

      {memory.story && (
        <p className={styles.caption}>{memory.story.substring(0, 100)}...</p>
      )}
    </div>
  )
}

import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, Camera, CandyCane, Cookie, Flame, Gift, Lock, Snowflake, Star, TreePine } from 'lucide-react'
import EncryptedImage from '../media/EncryptedImage'
import { thumbAt, tinyPreviewAt } from '../../utils/mediaThumbs'
import { focusStyleAt } from '../../utils/mediaFocus'

// The big doors, as on a paper calendar: Saint Nicholas' Day and Christmas Eve.
const SIZE = { 6: 'advent-door--wide', 24: 'advent-door--big' }

// Each door is printed in one of a few papers, so that the calendar reads as
// a printed sheet rather than a grid of buttons. Picked by day, not at
// random, so a door keeps its look from one visit to the next.
const PAPERS = ['red', 'green', 'cream', 'blue', 'gold']
const paperOf = (day) => (day === 24 ? 'red' : day === 6 ? 'gold' : PAPERS[(day * 7) % PAPERS.length])

// Christmas Eve opens as a double door; every other door has one leaf.
const LEAVES = { 24: ['left', 'right'] }

const SPARKS = 8

// A few doors carry a small picture above their number, as printed ones do:
// a candy cane for Saint Nicholas, a candle for Saint Lucy on the 13th, and
// otherwise the season's usual things. Not every door, or none would stand out.
const MOTIFS = { 2: Snowflake, 5: Bell, 6: CandyCane, 9: TreePine, 13: Flame, 16: Star, 19: Cookie, 21: Snowflake, 23: TreePine }

/**
 * One door. Closed it shows its number; opened it swings aside to show what
 * is behind it. What is behind is not even rendered before the door is open,
 * so a closed door decrypts nothing and gives nothing away.
 */
function AdventDoor({ door, isOpen, openable, isToday, dateLabel, onOpen, onShow, onLocked }) {
  const { t } = useTranslation('advent')
  const [shaking, setShaking] = useState(false)
  const [sparkling, setSparkling] = useState(false)
  const { day, entry } = door
  const doc = entry?.doc
  const photo = doc?.images?.[0] || doc?.imageUrl
  const leaves = LEAVES[day] || ['left']
  const Motif = MOTIFS[day]

  const handleClick = () => {
    if (isOpen) return onShow(door)
    if (!openable) {
      setShaking(true)
      onLocked(door)
      return
    }
    setSparkling(true)
    onOpen(door)
  }

  const classes = [
    'advent-door',
    `advent-door--${paperOf(day)}`,
    SIZE[day] || '',
    isOpen ? 'advent-door--open' : '',
    !isOpen && isToday ? 'advent-door--today' : '',
    !openable ? 'advent-door--locked' : '',
    shaking ? 'advent-door--shake' : '',
  ].join(' ')

  return (
    <button
      type="button"
      className={classes}
      onClick={handleClick}
      onAnimationEnd={(e) => { if (e.target === e.currentTarget) setShaking(false) }}
      aria-label={openable ? (isOpen ? t('doorLabel', { day }) : t('openDoor', { day })) : t('lockedDoor', { day, date: dateLabel })}
    >
      <span className="advent-door__behind">
        {isOpen && (photo ? (
          <EncryptedImage
            src={photo}
            thumbSrc={thumbAt(doc, 0)}
            tinyPreview={tinyPreviewAt(doc, 0)}
            alt=""
            style={focusStyleAt(doc, 0)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2 text-center">
            {entry ? (
              <>
                {entry.type === 'moment' ? <Camera className="w-5 h-5 text-kaydo" /> : <Star className="w-5 h-5 text-kaydo" />}
                <span className="font-serif text-[11px] leading-tight text-bark line-clamp-3">
                  {doc.title || doc.caption || ''}
                </span>
              </>
            ) : (
              <Gift className="w-6 h-6 text-kaydo" />
            )}
          </span>
        ))}
      </span>

      {leaves.map((side) => (
        <span key={side} className={`advent-door__leaf advent-door__leaf--${side}`} aria-hidden="true">
          {leaves.length === 1 && Motif && <Motif className="advent-door__motif" />}
          {leaves.length === 1 && <span className="advent-door__number">{day}</span>}
        </span>
      ))}

      {/* The double door's number hangs across both leaves, like a gift tag,
          and goes with them. */}
      {leaves.length > 1 && (
        <span className="advent-door__tag" aria-hidden="true">
          <Star className="advent-door__tag-star" />
          <span className="advent-door__number">{day}</span>
        </span>
      )}

      {!isOpen && isToday && <span className="advent-door__today" aria-hidden="true">{t('today')}</span>}
      {!openable && <Lock className="advent-door__lock" aria-hidden="true" />}

      {sparkling && (
        <span className="advent-door__sparks" aria-hidden="true" onAnimationEnd={() => setSparkling(false)}>
          {Array.from({ length: SPARKS }, (_, i) => (
            <span key={i} style={{ '--angle': `${(360 / SPARKS) * i}deg` }} />
          ))}
        </span>
      )}
    </button>
  )
}

export default memo(AdventDoor)

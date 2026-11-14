import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Camera, Gift, Lock, Star } from 'lucide-react'
import EncryptedImage from '../media/EncryptedImage'
import { thumbAt, tinyPreviewAt } from '../../utils/mediaThumbs'
import { focusStyleAt } from '../../utils/mediaFocus'

// The big doors, as on a paper calendar: Saint Nicholas' Day and Christmas Eve.
const SIZE = { 6: 'col-span-2', 24: 'col-span-2 row-span-2' }

/**
 * One door. Closed it shows its number; opened it swings aside to show what
 * is behind it. What is behind is not even rendered before the door is open,
 * so a closed door decrypts nothing and gives nothing away.
 */
function AdventDoor({ door, isOpen, openable, isToday, dateLabel, onOpen, onShow, onLocked }) {
  const { t } = useTranslation('advent')
  const [shaking, setShaking] = useState(false)
  const { day, entry } = door
  const doc = entry?.doc
  const photo = doc?.images?.[0] || doc?.imageUrl

  const handleClick = () => {
    if (isOpen) return onShow(door)
    if (!openable) {
      setShaking(true)
      onLocked(door)
      return
    }
    onOpen(door)
  }

  const classes = [
    'advent-door',
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
      onAnimationEnd={() => setShaking(false)}
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
        {isOpen && (
          <span className="absolute top-1 left-1.5 text-xs font-bold text-white drop-shadow">{day}</span>
        )}
      </span>
      <span className="advent-door__leaf" aria-hidden="true">
        <span className={`font-serif font-bold text-kaydo-dark ${SIZE[day] ? 'text-4xl sm:text-5xl' : 'text-2xl sm:text-3xl'}`}>
          {day}
        </span>
        {!openable && <Lock className="absolute bottom-1.5 right-1.5 w-3 h-3 text-bark-muted/60" />}
      </span>
    </button>
  )
}

export default memo(AdventDoor)

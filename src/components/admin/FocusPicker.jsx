import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import EncryptedImage from '../media/EncryptedImage'
import { CENTER_FOCUS, formatFocus, parseFocus } from '../../utils/mediaFocus'

// The shapes a moment photo is cropped to: the story on a phone and the moments
// grid are tall, the viewer on a desktop is 4:5.
const FRAMES = [
  { key: 'tall', className: 'w-16 aspect-[9/16]' },
  { key: 'portrait', className: 'w-20 aspect-[4/5]' },
]

function Picture({ item, className, style }) {
  return item.preview?.startsWith('blob:') ? (
    <img src={item.preview} alt="" draggable={false} className={className} style={style} />
  ) : (
    <EncryptedImage src={item.preview} draggable={false} className={className} style={style} />
  )
}

/**
 * Pick the part of a photo that stays in view where it is cropped. The whole
 * photo is shown; tapping or dragging on it moves the focus point, and the
 * frames beside it show what that leaves.
 */
export default function FocusPicker({ item, onSave, onClose }) {
  const { t } = useTranslation('memory')
  const [point, setPoint] = useState(() => parseFocus(item.focus) || CENTER_FOCUS)
  const areaRef = useRef(null)

  const moveTo = (e) => {
    const rect = areaRef.current.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const clamp = (n) => Math.min(100, Math.max(0, n))
    setPoint({
      x: clamp(((e.clientX - rect.left) / rect.width) * 100),
      y: clamp(((e.clientY - rect.top) / rect.height) * 100),
    })
  }
  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    moveTo(e)
  }
  const handlePointerMove = (e) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) moveTo(e)
  }
  const handleKeyDown = (e) => {
    const step = { ArrowLeft: [-5, 0], ArrowRight: [5, 0], ArrowUp: [0, -5], ArrowDown: [0, 5] }[e.key]
    if (!step) return
    e.preventDefault()
    setPoint((p) => ({
      x: Math.min(100, Math.max(0, p.x + step[0])),
      y: Math.min(100, Math.max(0, p.y + step[1])),
    }))
  }

  const position = `${point.x}% ${point.y}%`

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-warm-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-bark">{t('focus.title')}</h3>
          <button type="button" onClick={onClose} className="text-bark-muted hover:text-bark" aria-label={t('focus.cancel')}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-bark-muted">{t('focus.hint')}</p>

        <div className="flex gap-4 items-start">
          <div className="flex-1 min-w-0 flex justify-center">
            <div
              ref={areaRef}
              role="slider"
              tabIndex={0}
              aria-label={t('focus.title')}
              aria-valuetext={t('focus.value', { x: Math.round(point.x), y: Math.round(point.y) })}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onKeyDown={handleKeyDown}
              className="relative inline-block touch-none cursor-crosshair select-none rounded-xl overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-kaydo"
            >
              <Picture item={item} className="block max-w-full max-h-72 pointer-events-none" />
              <span
                className="absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full border-2 border-white bg-kaydo/40 shadow pointer-events-none"
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-3 shrink-0">
            {FRAMES.map((frame) => (
              <div key={frame.key} className={`relative ${frame.className} rounded-lg overflow-hidden bg-cream-dark`}>
                <Picture
                  item={item}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                  style={{ objectPosition: position }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setPoint(CENTER_FOCUS)}
            className="flex-1 py-2.5 rounded-xl bg-cream-dark text-bark font-medium hover:bg-cream-dark/70"
          >
            {t('focus.reset')}
          </button>
          <button type="button" onClick={() => onSave(formatFocus(point))} className="btn-kaydo flex-1">
            {t('focus.done')}
          </button>
        </div>
      </div>
    </div>
  )
}

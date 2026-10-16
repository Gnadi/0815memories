import { useEffect, useId, useRef, useState } from 'react'
import { ALargeSmall } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { TEXT_SIZE_STEPS, useTextSize } from '../utils/textSize'

// Text size slider. The choice is per device (src/utils/textSize.js), so it is
// offered to everyone, viewers included.
//
// variant:
//   "sidebar"  — full-width row like the navigation items; the slider opens
//                in a popover above it
//   "icon"     — compact header button; the slider opens in a popover below
//   "settings" — labelled block with the slider inline, for the settings page

// The slider is sized in px, not rem: everything in rem grows while the slider
// is dragged, and a control that moves under the finger is hard to hit.
function Slider({ labelId }) {
  const { t } = useTranslation('common')
  const [size, setSize] = useTextSize()
  const index = TEXT_SIZE_STEPS.indexOf(size)

  return (
    <>
      <div className="flex items-center gap-2.5">
        <span className="font-bold text-[12px] leading-none" aria-hidden="true">A</span>
        <input
          type="range"
          min={0}
          max={TEXT_SIZE_STEPS.length - 1}
          step={1}
          value={index}
          onChange={(e) => setSize(TEXT_SIZE_STEPS[Number(e.target.value)])}
          aria-labelledby={labelId}
          aria-valuetext={`${size}%`}
          className="flex-1 h-1 accent-kaydo"
        />
        <span className="font-bold text-[20px] leading-none" aria-hidden="true">A</span>
      </div>
      <div className="mt-2.5 text-center text-[12px] font-semibold tabular-nums text-bark-light" aria-live="polite">
        {t('textSize.percent', { value: size })}
      </div>
    </>
  )
}

export default function TextSizeSwitcher({ variant = 'sidebar' }) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const buttonRef = useRef(null)
  const labelId = useId()
  const popoverId = useId()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (variant === 'settings') {
    return (
      <div>
        <div id={labelId} className="flex items-center gap-1.5 text-sm font-medium text-bark mb-1.5">
          <ALargeSmall className="w-4 h-4" />
          {t('textSize.label')}
        </div>
        <p className="text-xs text-bark-muted mb-3">{t('textSize.description')}</p>
        <div className="max-w-[260px] text-bark">
          <Slider labelId={labelId} />
        </div>
      </div>
    )
  }

  const toggle = variant === 'icon' ? (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={popoverId}
      aria-label={t('textSize.adjust')}
      className="p-2 text-bark-light hover:text-kaydo transition-colors"
    >
      <ALargeSmall className="w-5 h-5" />
    </button>
  ) : (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => setOpen((o) => !o)}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={popoverId}
      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-bark-light hover:bg-cream-dark hover:text-bark transition-colors"
    >
      <ALargeSmall className="w-5 h-5" />
      {t('textSize.label')}
    </button>
  )

  const position = variant === 'icon' ? 'right-0 top-full mt-2.5' : 'left-0 bottom-full mb-2.5'

  return (
    <div className="relative" ref={ref}>
      {toggle}
      {open && (
        <div
          id={popoverId}
          role="dialog"
          aria-labelledby={labelId}
          className={`absolute ${position} z-50 w-[210px] p-[14px] rounded-[12px] bg-warm-white border border-cream-dark shadow-[0_10px_30px_rgba(0,0,0,0.12)] text-bark`}
        >
          <div id={labelId} className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-bark-light">
            {t('textSize.label')}
          </div>
          <Slider labelId={labelId} />
        </div>
      )}
    </div>
  )
}

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
//
// Every step resizes the whole page, so whatever the slider is anchored to
// moves while it is dragged: the header grows, the sidebar grows past the
// screen. A slider that slides away under the finger was the first version's
// worst flaw. So the popover is pinned to where it opened, and sized in px so
// it does not grow itself, and the inline slider scrolls the page to stay put.

const GAP = 10

function Slider({ labelId, keepInPlace = false }) {
  const { t } = useTranslation('common')
  const [size, setSize] = useTextSize()
  const ref = useRef(null)
  const index = TEXT_SIZE_STEPS.indexOf(size)

  const handleChange = (e) => {
    const next = TEXT_SIZE_STEPS[Number(e.target.value)]
    const before = keepInPlace ? ref.current?.getBoundingClientRect().top : undefined
    // Applies the size to the page synchronously, so the new layout can be
    // measured right away.
    setSize(next)
    if (before === undefined) return
    const shift = ref.current.getBoundingClientRect().top - before
    if (shift) window.scrollBy(0, shift)
  }

  return (
    <div ref={ref}>
      <div className="flex items-center gap-[10px]">
        <span className="font-bold text-[12px] leading-none" aria-hidden="true">A</span>
        <input
          type="range"
          min={0}
          max={TEXT_SIZE_STEPS.length - 1}
          step={1}
          value={index}
          onChange={handleChange}
          aria-labelledby={labelId}
          aria-valuetext={`${size}%`}
          className="flex-1 h-[4px] accent-kaydo"
        />
        <span className="font-bold text-[20px] leading-none" aria-hidden="true">A</span>
      </div>
      <div className="mt-[10px] text-center text-[12px] font-semibold tabular-nums text-bark-light" aria-live="polite">
        {t('textSize.percent', { value: size })}
      </div>
    </div>
  )
}

export default function TextSizeSwitcher({ variant = 'sidebar' }) {
  const { t } = useTranslation('common')
  // Where the open popover sits on screen, in px; null while closed.
  const [position, setPosition] = useState(null)
  const ref = useRef(null)
  const buttonRef = useRef(null)
  const labelId = useId()
  const popoverId = useId()
  const open = position !== null

  useEffect(() => {
    if (!open) return
    const close = () => setPosition(null)
    const onPointerDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) close()
    }
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      close()
      buttonRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
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
          <Slider labelId={labelId} keepInPlace />
        </div>
      </div>
    )
  }

  // Measured once, when the popover opens, and then left alone.
  const toggleOpen = () => {
    if (open) {
      setPosition(null)
      return
    }
    const rect = buttonRef.current.getBoundingClientRect()
    setPosition(variant === 'icon'
      ? { top: rect.bottom + GAP, right: window.innerWidth - rect.right }
      : { bottom: window.innerHeight - rect.top + GAP, left: rect.left })
  }

  const toggleProps = {
    ref: buttonRef,
    type: 'button',
    onClick: toggleOpen,
    'aria-haspopup': 'dialog',
    'aria-expanded': open,
    'aria-controls': popoverId,
  }

  const toggle = variant === 'icon' ? (
    <button
      {...toggleProps}
      aria-label={t('textSize.adjust')}
      className="p-2 text-bark-light hover:text-kaydo transition-colors"
    >
      <ALargeSmall className="w-5 h-5" />
    </button>
  ) : (
    <button
      {...toggleProps}
      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-bark-light hover:bg-cream-dark hover:text-bark transition-colors"
    >
      <ALargeSmall className="w-5 h-5" />
      {t('textSize.label')}
    </button>
  )

  return (
    <div ref={ref}>
      {toggle}
      {open && (
        <div
          id={popoverId}
          role="dialog"
          aria-labelledby={labelId}
          style={position}
          className="fixed z-50 w-[210px] p-[14px] rounded-[12px] bg-warm-white border border-cream-dark shadow-[0_10px_30px_rgba(0,0,0,0.12)] text-bark"
        >
          <div id={labelId} className="mb-[10px] text-[11px] font-semibold uppercase tracking-[0.05em] text-bark-light">
            {t('textSize.label')}
          </div>
          <Slider labelId={labelId} />
        </div>
      )}
    </div>
  )
}

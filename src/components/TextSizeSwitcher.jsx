import { useEffect, useRef, useState } from 'react'
import { ALargeSmall } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { TEXT_SIZES, useTextSize } from '../utils/textSize'

// Text size picker. The choice is per device (src/utils/textSize.js), so it is
// offered to everyone, viewers included.
//
// variant:
//   "sidebar"  — compact segmented control for the navigation sidebar
//   "settings" — labelled block with a leading icon for the settings page
//   "menu"     — icon button that opens the control in a panel, for the
//                mobile header where a segmented control does not fit
const LETTER_CLASS = { normal: 'text-sm', large: 'text-lg', xlarge: 'text-2xl' }

function Segmented({ label }) {
  const { t } = useTranslation('common')
  const [size, setSize] = useTextSize()

  return (
    <div className="inline-flex items-end rounded-xl bg-cream-dark p-0.5" role="group" aria-label={label}>
      {TEXT_SIZES.map((value) => {
        const active = size === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => setSize(value)}
            aria-pressed={active}
            aria-label={t(`textSize.${value}`)}
            title={t(`textSize.${value}`)}
            className={`px-3 py-1 rounded-lg font-medium leading-tight transition-colors ${LETTER_CLASS[value]} ${
              active ? 'bg-kaydo-dark text-white shadow-sm' : 'text-bark-light hover:text-bark'
            }`}
          >
            A
          </button>
        )
      })}
    </div>
  )
}

export default function TextSizeSwitcher({ variant = 'sidebar' }) {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
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
        <label className="block text-sm font-medium text-bark mb-1.5">
          <div className="flex items-center gap-1.5">
            <ALargeSmall className="w-4 h-4" />
            {t('textSize.label')}
          </div>
        </label>
        <p className="text-xs text-bark-muted mb-3">{t('textSize.description')}</p>
        <Segmented label={t('textSize.label')} />
      </div>
    )
  }

  if (variant === 'menu') {
    return (
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={t('textSize.label')}
          className="p-2 text-bark-light hover:text-kaydo transition-colors"
        >
          <ALargeSmall className="w-5 h-5" />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-2 z-40 rounded-2xl bg-warm-white border border-cream-dark shadow-lg p-3">
            <Segmented label={t('textSize.label')} />
          </div>
        )}
      </div>
    )
  }

  return <Segmented label={t('textSize.label')} />
}

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Check,
  Camera,
  Replace,
  Maximize2,
  RotateCw,
  FlipHorizontal2,
  ImageOff,
  Trash2,
} from 'lucide-react'

/**
 * Contextual bottom bar shown when a filled photo element is selected.
 * Mirrors the reference action strip: Done · Change · Swap · Scale · Rotate · Flip
 * Plus two destructive actions: Remove picture (keep slot empty) and Remove.
 *
 * Props:
 *  - element: the selected photo element
 *  - onDone()
 *  - onChange()                  → triggers PhotoBar "replace" mode
 *  - onSwap()                    → triggers PhotoBar "swap" mode
 *  - onRotate()                  → 90° step clockwise
 *  - onFlip()
 *  - onScale(newScale)           → 0.5..3
 *  - onRemovePicture()           → clears url, keeps slot
 *  - onRemove()                  → deletes the element
 *  - mode: 'idle' | 'replace' | 'swap' (to highlight active action)
 */
export default function PhotoActionBar({
  element,
  onDone,
  onChange,
  onSwap,
  onRotate,
  onFlip,
  onScale,
  onRemovePicture,
  onRemove,
  mode = 'idle',
}) {
  const { t } = useTranslation('scrapbook')
  const [showScale, setShowScale] = useState(false)
  const currentScale = element?.imageScale || 1

  const actions = [
    { id: 'done', icon: Check, label: t('photoActions.done'), onClick: onDone, primary: true },
    { id: 'change', icon: Camera, label: t('photoActions.change'), onClick: onChange, active: mode === 'replace' },
    { id: 'swap', icon: Replace, label: t('photoActions.swap'), onClick: onSwap, active: mode === 'swap' },
    { id: 'scale', icon: Maximize2, label: t('photoActions.scale'), onClick: () => setShowScale((s) => !s), active: showScale },
    { id: 'rotate', icon: RotateCw, label: t('photoActions.rotate'), onClick: onRotate },
    { id: 'flip', icon: FlipHorizontal2, label: t('photoActions.flip'), onClick: onFlip },
    { id: 'remove-picture', icon: ImageOff, label: t('photoActions.clear'), onClick: onRemovePicture, variant: 'warn' },
    { id: 'remove', icon: Trash2, label: t('photoActions.remove'), onClick: onRemove, variant: 'danger' },
  ]

  return (
    <div className="bg-warm-white border-t border-cream-dark">
      {showScale && (
        <div className="px-4 pt-3 pb-1 flex items-center gap-3">
          <span className="text-[11px] font-medium text-bark-muted whitespace-nowrap">{t('photoActions.zoom')}</span>
          <input
            type="range"
            min={0.5}
            max={3}
            step={0.05}
            value={currentScale}
            onChange={(e) => onScale?.(parseFloat(e.target.value))}
            className="flex-1 accent-kaydo"
          />
          <span className="text-[11px] font-mono text-bark-light w-12 text-right">
            {currentScale.toFixed(2)}×
          </span>
          <button
            type="button"
            onClick={() => onScale?.(1)}
            className="text-[11px] font-medium text-kaydo hover:text-kaydo-dark"
          >
            {t('photoActions.reset')}
          </button>
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto hide-scrollbar px-2 py-3">
        {actions.map(({ id, icon: Icon, label, onClick, primary, active, variant }) => (
          <button
            key={id}
            type="button"
            onClick={onClick}
            className={`flex-shrink-0 flex flex-col items-center justify-center gap-1 px-3 py-2 min-w-[68px] rounded-xl transition-colors ${
              primary
                ? 'bg-bark text-warm-white hover:bg-bark/90'
                : active
                  ? 'bg-kaydo/15 text-kaydo'
                  : variant === 'danger'
                    ? 'text-red-500 hover:bg-red-50'
                    : variant === 'warn'
                      ? 'text-bark-light hover:bg-cream'
                      : 'text-bark hover:bg-cream'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[11px] font-medium leading-none">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

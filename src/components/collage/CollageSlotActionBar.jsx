import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Check,
  Camera,
  Replace,
  Maximize2,
  Move,
  FlipHorizontal2,
  ImageOff,
} from 'lucide-react'

/**
 * Contextual bar for the selected collage slot. Mirrors the scrapbook's
 * PhotoActionBar, minus the actions a collage cannot offer: a slot belongs to
 * the template, so it can be emptied but never deleted or rotated on its own.
 */
export default function CollageSlotActionBar({
  slot,
  onDone,
  onChange,
  onSwap,
  onScale,
  onPan,
  onFlip,
  onClear,
  mode = 'idle',
}) {
  const { t } = useTranslation('collage')
  const [panel, setPanel] = useState(null)
  const scale = slot?.imageScale || 1

  const actions = [
    { id: 'done', icon: Check, label: t('slotActions.done'), onClick: onDone, primary: true },
    { id: 'change', icon: Camera, label: t('slotActions.change'), onClick: onChange, active: mode === 'replace' },
    { id: 'swap', icon: Replace, label: t('slotActions.swap'), onClick: onSwap, active: mode === 'swap' },
    { id: 'zoom', icon: Maximize2, label: t('slotActions.zoom'), onClick: () => setPanel((p) => (p === 'zoom' ? null : 'zoom')), active: panel === 'zoom' },
    { id: 'pan', icon: Move, label: t('slotActions.reposition'), onClick: () => setPanel((p) => (p === 'pan' ? null : 'pan')), active: panel === 'pan' },
    { id: 'flip', icon: FlipHorizontal2, label: t('slotActions.flip'), onClick: onFlip },
    { id: 'clear', icon: ImageOff, label: t('slotActions.clear'), onClick: onClear, variant: 'warn' },
  ]

  return (
    <div className="bg-warm-white border-t border-cream-dark">
      {panel === 'zoom' && (
        <div className="px-4 pt-3 pb-1 flex items-center gap-3">
          <span className="text-[11px] font-medium text-bark-muted whitespace-nowrap">{t('slotActions.zoom')}</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={scale}
            onChange={(e) => onScale?.(parseFloat(e.target.value))}
            className="flex-1 accent-kaydo"
          />
          <span className="text-[11px] font-mono text-bark-light w-12 text-right">{scale.toFixed(2)}×</span>
          <button type="button" onClick={() => onScale?.(1)} className="text-[11px] font-medium text-kaydo">
            {t('slotActions.reset')}
          </button>
        </div>
      )}

      {panel === 'pan' && (
        <div className="px-4 pt-3 pb-1 space-y-1">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium text-bark-muted w-8">↔</span>
            <input
              type="range" min={-1} max={1} step={0.05}
              value={slot?.offsetX || 0}
              onChange={(e) => onPan?.({ offsetX: parseFloat(e.target.value) })}
              className="flex-1 accent-kaydo"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium text-bark-muted w-8">↕</span>
            <input
              type="range" min={-1} max={1} step={0.05}
              value={slot?.offsetY || 0}
              onChange={(e) => onPan?.({ offsetY: parseFloat(e.target.value) })}
              className="flex-1 accent-kaydo"
            />
          </div>
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto hide-scrollbar px-2 py-3">
        {actions.map((action) => {
          const { id, label, onClick, primary, active, variant } = action
          const Icon = action.icon
          return (
          <button
            key={id}
            type="button"
            onClick={onClick}
            className={`flex-shrink-0 flex flex-col items-center justify-center gap-1 px-3 py-2 min-w-[68px] rounded-xl transition-colors ${
              primary
                ? 'bg-bark text-warm-white hover:bg-bark/90'
                : active
                  ? 'bg-kaydo/15 text-kaydo'
                  : variant === 'warn'
                    ? 'text-bark-light hover:bg-cream'
                    : 'text-bark hover:bg-cream'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[11px] font-medium leading-none">{label}</span>
          </button>
          )
        })}
      </div>
    </div>
  )
}

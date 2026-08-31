import { useState } from 'react'
import {
  Check,
  Palette,
  Type,
  ALargeSmall,
  Bold,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2,
} from 'lucide-react'

const FONT_SIZES = [12, 14, 16, 18, 24, 36, 48, 72]

const TEXT_COLORS = [
  '#2D1B0E', '#000000', '#7A6A5E', '#B8A99C', '#FFFFFF', '#FFFDF9', '#F5E6D0',
  '#C25A2E', '#A04420', '#3B5E8A', '#4A7C59', '#7B3F6E', '#FFF5F5', '#FBCFE8',
]

const FONT_OPTIONS = [
  { key: 'display', label: 'Display', family: "'Anton', Impact, sans-serif" },
  { key: 'serif',   label: 'Serif',   family: 'Georgia, serif' },
  { key: 'sans',    label: 'Sans',    family: 'system-ui, sans-serif' },
  { key: 'mono',    label: 'Mono',    family: 'ui-monospace, monospace' },
]

/**
 * Contextual bottom bar shown when a text element is selected.
 * Provides live controls for color, font size, font family, bold, and alignment.
 *
 * Props:
 *  - element: the selected text element
 *  - onDone()
 *  - onUpdate(updates)   → partial updates dispatched to UPDATE_ELEMENT
 *  - onRemove()          → deletes the element
 */
export default function TextActionBar({ element, onDone, onUpdate, onRemove }) {
  const [openPanel, setOpenPanel] = useState(null)

  const toggle = (key) => setOpenPanel((prev) => (prev === key ? null : key))

  const currentColor = element?.color || '#2D1B0E'
  const currentSize = element?.fontSize || 18
  const currentFont = element?.fontFamily || 'sans'
  const isBold = element?.fontWeight === 'bold'
  const align = element?.textAlign || 'center'

  const stepSize = (dir) => {
    const idx = FONT_SIZES.indexOf(currentSize)
    const clampedIdx = idx === -1 ? FONT_SIZES.findIndex((s) => s >= currentSize) : idx
    const baseIdx = clampedIdx === -1 ? FONT_SIZES.length - 1 : clampedIdx
    const nextIdx = Math.max(0, Math.min(FONT_SIZES.length - 1, baseIdx + dir))
    onUpdate({ fontSize: FONT_SIZES[nextIdx] })
  }

  const actions = [
    {
      id: 'done',
      icon: Check,
      label: 'Done',
      onClick: onDone,
      primary: true,
    },
    {
      id: 'color',
      icon: Palette,
      label: 'Color',
      onClick: () => toggle('color'),
      active: openPanel === 'color',
    },
    {
      id: 'size',
      icon: Type,
      label: 'Size',
      onClick: () => toggle('size'),
      active: openPanel === 'size',
    },
    {
      id: 'font',
      icon: ALargeSmall,
      label: 'Font',
      onClick: () => toggle('font'),
      active: openPanel === 'font',
    },
    {
      id: 'bold',
      icon: Bold,
      label: 'Bold',
      onClick: () => onUpdate({ fontWeight: isBold ? 'normal' : 'bold' }),
      active: isBold,
    },
    {
      id: 'align-left',
      icon: AlignLeft,
      label: 'Left',
      onClick: () => onUpdate({ textAlign: 'left' }),
      active: align === 'left',
    },
    {
      id: 'align-center',
      icon: AlignCenter,
      label: 'Center',
      onClick: () => onUpdate({ textAlign: 'center' }),
      active: align === 'center',
    },
    {
      id: 'align-right',
      icon: AlignRight,
      label: 'Right',
      onClick: () => onUpdate({ textAlign: 'right' }),
      active: align === 'right',
    },
    {
      id: 'remove',
      icon: Trash2,
      label: 'Remove',
      onClick: onRemove,
      variant: 'danger',
    },
  ]

  return (
    <div className="bg-warm-white border-t border-cream-dark">
      {/* Color sub-panel */}
      {openPanel === 'color' && (
        <div className="px-4 pt-3 pb-2">
          <span className="text-[11px] font-medium text-bark-muted block mb-2">Color</span>
          <div className="grid grid-cols-7 gap-2">
            {TEXT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onUpdate({ color })}
                style={{ backgroundColor: color }}
                className={`w-7 h-7 rounded-full border transition-all ${
                  color === '#FFFFFF' || color === '#FFFDF9' || color === '#F5E6D0' || color === '#FFF5F5' || color === '#FBCFE8'
                    ? 'border-cream-dark'
                    : 'border-transparent'
                } ${
                  currentColor === color
                    ? 'ring-2 ring-offset-1 ring-kaydo scale-110'
                    : 'hover:scale-105'
                }`}
                aria-label={`Set color to ${color}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Size sub-panel */}
      {openPanel === 'size' && (
        <div className="px-4 pt-3 pb-2 flex items-center gap-3">
          <span className="text-[11px] font-medium text-bark-muted whitespace-nowrap">Size</span>
          <button
            type="button"
            onClick={() => stepSize(-1)}
            disabled={FONT_SIZES.indexOf(currentSize) <= 0}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-cream hover:bg-cream-dark text-bark font-bold text-lg disabled:opacity-30 transition-colors"
          >
            −
          </button>
          <span className="text-[13px] font-mono text-bark w-14 text-center">
            {currentSize} px
          </span>
          <button
            type="button"
            onClick={() => stepSize(1)}
            disabled={FONT_SIZES.indexOf(currentSize) >= FONT_SIZES.length - 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-cream hover:bg-cream-dark text-bark font-bold text-lg disabled:opacity-30 transition-colors"
          >
            +
          </button>
        </div>
      )}

      {/* Font family sub-panel */}
      {openPanel === 'font' && (
        <div className="px-4 pt-3 pb-2">
          <span className="text-[11px] font-medium text-bark-muted block mb-2">Font</span>
          <div className="grid grid-cols-4 gap-2">
            {FONT_OPTIONS.map(({ key, label, family }) => (
              <button
                key={key}
                type="button"
                onClick={() => onUpdate({ fontFamily: key })}
                className={`flex flex-col items-center gap-0.5 px-2 py-2 rounded-xl border transition-colors ${
                  currentFont === key
                    ? 'bg-kaydo/15 text-kaydo border-kaydo/30'
                    : 'text-bark border-transparent bg-cream hover:bg-cream-dark'
                }`}
              >
                <span style={{ fontFamily: family, fontSize: 18 }}>Aa</span>
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action strip */}
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

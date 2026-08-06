import { useTranslation } from 'react-i18next'
import { BORDER_COLORS, DEFAULT_BORDER } from './collageTemplates'

const BG_SWATCHES = [
  '#FDF6EC', '#FFFDF9', '#F5E6D0', '#A8C7FA', '#F7D6C4',
  '#2D1B0E', '#1C1917', '#C25A2E', '#3B5E8A', '#4A7C59', '#7B3F6E',
]

function Slider({ label, value, min, max, step, onChange, format }) {
  return (
    <label className="flex items-center gap-3 px-4 py-1.5">
      <span className="text-[11px] font-medium text-bark-muted w-16 flex-shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-kaydo"
      />
      <span className="text-[11px] tabular-nums text-bark-muted w-9 text-right">{format(value)}</span>
    </label>
  )
}

/**
 * The "Borders" tab of the editor: frame colour and thickness, corner rounding,
 * the gap between photos, and the colour showing through behind them.
 */
export default function BorderPanel({ border, background, onChangeBorder, onChangeBackground }) {
  const { t } = useTranslation('collage')
  const current = { ...DEFAULT_BORDER, ...(border || {}) }

  return (
    <div className="bg-warm-white border-t border-cream-dark pb-2">
      <div className="px-4 pt-3 pb-1">
        <h3 className="text-sm font-semibold text-bark">{t('borders.heading')}</h3>
      </div>

      <div className="flex gap-2 overflow-x-auto hide-scrollbar px-4 pb-2">
        {BORDER_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={t('borders.frameColor')}
            onClick={() => onChangeBorder({ color, width: current.width || 0.012 })}
            className={`flex-shrink-0 w-8 h-8 rounded-full border-2 transition-transform active:scale-95 ${
              current.color === color ? 'border-kaydo scale-110' : 'border-cream-dark'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      <Slider
        label={t('borders.thickness')}
        value={current.width}
        min={0}
        max={0.05}
        step={0.002}
        onChange={(width) => onChangeBorder({ width })}
        format={(v) => `${Math.round((v / 0.05) * 100)}%`}
      />
      <Slider
        label={t('borders.corners')}
        value={current.radius}
        min={0}
        max={0.5}
        step={0.01}
        onChange={(radius) => onChangeBorder({ radius })}
        format={(v) => `${Math.round((v / 0.5) * 100)}%`}
      />
      <Slider
        label={t('borders.spacing')}
        value={current.gap}
        min={0}
        max={0.06}
        step={0.002}
        onChange={(gap) => onChangeBorder({ gap })}
        format={(v) => `${Math.round((v / 0.06) * 100)}%`}
      />

      <div className="px-4 pt-2 pb-1">
        <h3 className="text-[11px] font-semibold text-bark-muted uppercase tracking-wide">{t('borders.background')}</h3>
      </div>
      <div className="flex gap-2 overflow-x-auto hide-scrollbar px-4 pb-1">
        {BG_SWATCHES.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={t('borders.background')}
            onClick={() => onChangeBackground(color)}
            className={`flex-shrink-0 w-8 h-8 rounded-lg border-2 transition-transform active:scale-95 ${
              background === color ? 'border-kaydo scale-110' : 'border-cream-dark'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  )
}

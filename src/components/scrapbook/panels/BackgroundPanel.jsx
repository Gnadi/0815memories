import { BG_COLORS } from '../layoutPresets'

const PATTERNS = [
  { id: 'none', label: 'None' },
  { id: 'dots', label: 'Dots' },
  { id: 'grid', label: 'Grid' },
  { id: 'lines', label: 'Lines' },
]

export default function BackgroundPanel({ onChangeBackground, currentBackgroundColor, currentPattern }) {
  return (
    <div className="p-3">
      <p className="text-xs font-semibold text-bark-muted uppercase tracking-wide mb-2">Color</p>
      <div className="grid grid-cols-7 gap-2 mb-4">
        {BG_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChangeBackground({ backgroundColor: color })}
            className={`aspect-square rounded-lg border-2 transition-colors shadow-sm ${
              currentBackgroundColor === color
                ? 'border-kaydo ring-2 ring-kaydo/30'
                : 'border-cream-dark hover:border-kaydo'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
      <p className="text-xs font-semibold text-bark-muted uppercase tracking-wide mb-2">Pattern</p>
      <div className="grid grid-cols-2 gap-2">
        {PATTERNS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChangeBackground({ backgroundPattern: id })}
            className={`py-2 rounded-xl border text-xs font-medium transition-colors ${
              currentPattern === id
                ? 'border-kaydo bg-kaydo/10 text-kaydo'
                : 'border-cream-dark bg-cream hover:border-kaydo hover:bg-kaydo/5 text-bark-light hover:text-kaydo'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

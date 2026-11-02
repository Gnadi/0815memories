import { useTranslation } from 'react-i18next'
import { Check, Bold, AlignLeft, AlignCenter, AlignRight, Trash2 } from 'lucide-react'

// The faces CanvasElement knows how to draw; `sample` previews each in its own.
const FONTS = [
  { id: 'display', sample: "'Anton', Impact, sans-serif" },
  { id: 'serif', sample: 'Georgia, serif' },
  { id: 'sans', sample: 'system-ui, sans-serif' },
  { id: 'mono', sample: 'ui-monospace, monospace' },
]
const ALIGNS = [
  { id: 'left', icon: AlignLeft },
  { id: 'center', icon: AlignCenter },
  { id: 'right', icon: AlignRight },
]
const COLORS = ['#2D1B0E', '#C25A2E', '#7A6A5E', '#FFFFFF', '#2E6E4F', '#2F5D9E', '#B83A5B']
const MIN_SIZE = 8
const MAX_SIZE = 160

/**
 * Contextual bottom bar for a selected text element. Presets only choose a
 * starting style; this is how a text is restyled afterwards, e.g. a heading
 * turned into small body text.
 *
 *  - element: the selected text element
 *  - onChange(updates): { fontFamily } | { fontSize } | { fontWeight } | { textAlign } | { color }
 *  - onDone() / onRemove()
 */
export default function TextActionBar({ element, onChange, onDone, onRemove }) {
  const { t } = useTranslation('scrapbook')
  const fontFamily = element?.fontFamily || 'display'
  const fontSize = element?.fontSize || 20
  const bold = element?.fontWeight === 'bold'
  const align = element?.textAlign || 'center'
  const color = (element?.color || '#2D1B0E').toUpperCase()
  const tab = (active) => `flex-shrink-0 px-3 min-h-10 rounded-full text-sm border transition-colors ${
    active ? 'bg-kaydo/10 border-kaydo text-kaydo font-semibold' : 'bg-cream border-cream-dark text-bark-muted hover:text-bark'
  }`

  return (
    <div className="bg-warm-white border-t border-cream-dark px-4 pt-3 pb-2 space-y-2">
      <div role="group" aria-label={t('textBar.font')} className="flex gap-2 overflow-x-auto hide-scrollbar">
        {FONTS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={fontFamily === f.id}
            onClick={() => onChange({ fontFamily: f.id })}
            className={tab(fontFamily === f.id)}
            style={{ fontFamily: f.sample }}
          >
            {t(`textBar.fonts.${f.id}`)}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[11px] font-medium text-bark-muted w-10">{t('textBar.size')}</span>
        <input
          type="range" min={MIN_SIZE} max={MAX_SIZE} step={1}
          value={fontSize}
          onChange={(e) => onChange({ fontSize: parseInt(e.target.value, 10) })}
          aria-label={t('textBar.size')}
          className="flex-1 accent-kaydo"
        />
        <span className="text-[11px] font-mono text-bark-light w-12 text-right">{fontSize}px</span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
        <button
          type="button"
          aria-pressed={bold}
          aria-label={t('textBar.bold')}
          onClick={() => onChange({ fontWeight: bold ? 'normal' : 'bold' })}
          className={`${tab(bold)} flex items-center`}
        >
          <Bold className="w-4 h-4" />
        </button>
        {ALIGNS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={align === id}
            aria-label={t(`textBar.align.${id}`)}
            onClick={() => onChange({ textAlign: id })}
            className={`${tab(align === id)} flex items-center`}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
        <span className="w-px h-6 bg-cream-dark flex-shrink-0" aria-hidden="true" />
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={color === c}
            onClick={() => onChange({ color: c })}
            className={`flex-shrink-0 w-8 h-8 rounded-full border-2 ${color === c ? 'border-kaydo' : 'border-cream-dark'}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onDone} className="btn-kaydo text-sm py-2 px-4 min-h-10 flex items-center gap-1.5">
          <Check className="w-4 h-4" /> {t('photoActions.done')}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="px-4 min-h-10 rounded-xl text-sm text-red-600 border border-red-200 flex items-center gap-1.5"
        >
          <Trash2 className="w-4 h-4" /> {t('photoActions.remove')}
        </button>
      </div>
    </div>
  )
}

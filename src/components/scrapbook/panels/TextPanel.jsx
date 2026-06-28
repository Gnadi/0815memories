import { useTranslation } from 'react-i18next'

const TEXT_PRESETS = [
  { id: 'heading', fontSize: 48, fontWeight: 'bold', fontFamily: 'display', color: '#2D1B0E', textAlign: 'center' },
  { id: 'title', fontSize: 72, fontWeight: 'bold', fontFamily: 'display', color: '#C25A2E', textAlign: 'center' },
  { id: 'quote', fontSize: 26, fontWeight: 'normal', fontFamily: 'serif', color: '#2D1B0E', textAlign: 'center' },
  { id: 'caption', fontSize: 14, fontWeight: 'normal', fontFamily: 'sans', color: '#7A6A5E', textAlign: 'center' },
  { id: 'date', fontSize: 16, fontWeight: 'bold', fontFamily: 'mono', color: '#2D1B0E', textAlign: 'left' },
  { id: 'body', fontSize: 18, fontWeight: 'normal', fontFamily: 'sans', color: '#2D1B0E', textAlign: 'left' },
]

const FONT_STACK = {
  display: "'Anton', Impact, sans-serif",
  serif: 'Georgia, serif',
  sans: 'system-ui, sans-serif',
  mono: 'ui-monospace, monospace',
}

export default function TextPanel({ onAddElement }) {
  const { t } = useTranslation('scrapbook')
  const addTextBox = (preset) => {
    onAddElement({
      type: 'text',
      text: preset.id === 'quote'
        ? t('text.sample.quote')
        : preset.id === 'title'
          ? t('text.sample.title')
          : t(`text.presets.${preset.id}`),
      x: 200,
      y: 200,
      width: preset.id === 'title' ? 400 : 300,
      height: preset.id === 'title' ? 110 : 120,
      rotation: 0,
      ...preset,
      zIndex: Date.now(),
    })
  }

  return (
    <div className="p-3 space-y-2">
      <p className="text-[11px] text-bark-muted px-1">
        {t('text.fontHint', { font: 'Anton' })}
      </p>
      {TEXT_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => addTextBox(preset)}
          className="w-full text-left px-3 py-2.5 rounded-xl bg-cream hover:bg-cream-dark transition-colors"
        >
          <span
            style={{
              fontSize: Math.min(preset.fontSize, 22),
              fontWeight: preset.fontWeight,
              color: preset.color,
              fontFamily: FONT_STACK[preset.fontFamily] || FONT_STACK.sans,
              letterSpacing: preset.fontFamily === 'display' ? '0.02em' : 'normal',
            }}
          >
            {t(`text.presets.${preset.id}`)}
          </span>
          <p className="text-[10px] text-bark-muted mt-0.5">{preset.fontSize}px · {preset.fontFamily}</p>
        </button>
      ))}
    </div>
  )
}

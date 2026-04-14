const TEXT_PRESETS = [
  { label: 'Heading', fontSize: 48, fontWeight: 'bold', fontFamily: 'display', color: '#2D1B0E', textAlign: 'center' },
  { label: 'Title', fontSize: 72, fontWeight: 'bold', fontFamily: 'display', color: '#C25A2E', textAlign: 'center' },
  { label: 'Quote', fontSize: 26, fontWeight: 'normal', fontFamily: 'serif', color: '#2D1B0E', textAlign: 'center' },
  { label: 'Caption', fontSize: 14, fontWeight: 'normal', fontFamily: 'sans', color: '#7A6A5E', textAlign: 'center' },
  { label: 'Date', fontSize: 16, fontWeight: 'bold', fontFamily: 'mono', color: '#2D1B0E', textAlign: 'left' },
  { label: 'Body', fontSize: 18, fontWeight: 'normal', fontFamily: 'sans', color: '#2D1B0E', textAlign: 'left' },
]

const FONT_STACK = {
  display: "'Anton', Impact, sans-serif",
  serif: 'Georgia, serif',
  sans: 'system-ui, sans-serif',
  mono: 'ui-monospace, monospace',
}

export default function TextPanel({ onAddElement }) {
  const addTextBox = (preset) => {
    onAddElement({
      type: 'text',
      text: preset.label === 'Quote'
        ? '"Your beautiful memory goes here"'
        : preset.label === 'Title'
          ? 'YOUR TITLE'
          : preset.label,
      x: 200,
      y: 200,
      width: preset.label === 'Title' ? 400 : 300,
      height: preset.label === 'Title' ? 110 : 120,
      rotation: 0,
      ...preset,
      zIndex: Date.now(),
    })
  }

  return (
    <div className="p-3 space-y-2">
      <p className="text-[11px] text-bark-muted px-1">
        Title &amp; Heading use the <span className="font-display tracking-wide">Anton</span> display font.
      </p>
      {TEXT_PRESETS.map((preset) => (
        <button
          key={preset.label}
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
            {preset.label}
          </span>
          <p className="text-[10px] text-bark-muted mt-0.5">{preset.fontSize}px · {preset.fontFamily}</p>
        </button>
      ))}
    </div>
  )
}

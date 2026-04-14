import { LAYOUT_PRESETS } from '../layoutPresets'

/**
 * Layouts picker. Applying a layout replaces the current page's elements.
 * `onApplyLayout(elements)` is called with freshly-UUID'd element copies.
 */
export default function LayoutsPanel({ onApplyLayout, hasExistingElements = false }) {
  const applyLayout = (layout) => {
    if (layout.elements.length === 0 || !hasExistingElements || confirm('Replace current page with this layout? Existing elements will be removed.')) {
      onApplyLayout(layout.elements.map((el) => ({ ...el, id: crypto.randomUUID() })))
    }
  }

  const covers = LAYOUT_PRESETS.filter((l) => l.group === 'cover')
  const spreads = LAYOUT_PRESETS.filter((l) => l.group === 'spread')
  const blank = LAYOUT_PRESETS.find((l) => l.id === 'blank')

  return (
    <div className="p-3 space-y-4">
      <Section title="Blank">
        <LayoutGrid items={blank ? [blank] : []} onApply={applyLayout} />
      </Section>
      <Section title="Covers">
        <LayoutGrid items={covers} onApply={applyLayout} />
      </Section>
      <Section title="Spreads">
        <LayoutGrid items={spreads} onApply={applyLayout} />
      </Section>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold text-bark-muted uppercase tracking-wide mb-2">{title}</p>
      {children}
    </div>
  )
}

function LayoutGrid({ items, onApply }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((layout) => (
        <button
          key={layout.id}
          type="button"
          onClick={() => onApply(layout)}
          className="aspect-[4/3] rounded-xl border border-cream-dark hover:border-kaydo bg-cream hover:bg-kaydo/5 transition-colors flex flex-col items-center justify-center gap-1 px-2"
        >
          <MiniPreview layout={layout} />
          <span className="text-[10px] text-bark font-medium truncate max-w-full">{layout.label}</span>
        </button>
      ))}
    </div>
  )
}

// Very small visual preview of the layout (miniature of the canvas).
function MiniPreview({ layout }) {
  const W = 80, H = 60
  const scaleX = W / 800, scaleY = H / 600
  return (
    <div
      className="relative bg-warm-white border border-cream-dark rounded overflow-hidden"
      style={{ width: W, height: H }}
    >
      {layout.elements.map((el, i) => (
        <div
          key={i}
          className={
            el.type === 'photo'
              ? 'absolute bg-bark-muted/40 border border-bark-muted/60 rounded-[1px]'
              : 'absolute'
          }
          style={{
            left: el.x * scaleX,
            top: el.y * scaleY,
            width: el.width * scaleX,
            height: el.height * scaleY,
            transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
            ...(el.type === 'text'
              ? { color: el.color, fontWeight: 700, fontSize: 7, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }
              : {}),
          }}
        >
          {el.type === 'text' && <span className="truncate">{el.text}</span>}
        </div>
      ))}
      {layout.elements.length === 0 && <div className="absolute inset-0" />}
    </div>
  )
}

import { Camera } from 'lucide-react'
import {
  POLAROID_COLORS,
  POLAROID_WIDTHS,
  POLAROID_STYLES,
  POLAROID_DECORATIONS,
  resolvePolaroidBorder,
  isLightPolaroidColor,
} from '../home/polaroidBorder'

export default function PolaroidBorderEditor({ value, onChange }) {
  const border = resolvePolaroidBorder(value)
  const update = (patch) => onChange({ ...border, ...patch })

  return (
    <div className="rounded-2xl border border-cream-dark p-4 bg-cream/40">
      <div className="flex items-center gap-1.5 mb-3">
        <Camera className="w-4 h-4 text-kaydo" />
        <p className="text-sm font-semibold text-bark">Polaroid border</p>
      </div>
      <p className="text-xs text-bark-muted mb-4">
        Customize how this memory looks in the polaroid feed. Each memory can have its own frame.
      </p>

      <div className="flex justify-center mb-4">
        <BorderPreview border={border} />
      </div>

      <p className="text-xs font-semibold text-bark-muted uppercase tracking-wide mb-2">Color</p>
      <div className="grid grid-cols-7 gap-2 mb-3">
        {POLAROID_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => update({ color })}
            className={`aspect-square rounded-lg border-2 transition-colors shadow-sm ${
              border.color === color
                ? 'border-kaydo ring-2 ring-kaydo/30'
                : 'border-cream-dark hover:border-kaydo'
            }`}
            style={{ backgroundColor: color }}
            title={color}
            aria-label={`Border color ${color}`}
            aria-pressed={border.color === color}
          />
        ))}
      </div>

      <p className="text-xs font-semibold text-bark-muted uppercase tracking-wide mb-2">Width</p>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {POLAROID_WIDTHS.map(({ id, label }) => (
          <ToggleButton
            key={id}
            active={border.width === id}
            onClick={() => update({ width: id })}
            label={label}
          />
        ))}
      </div>

      <p className="text-xs font-semibold text-bark-muted uppercase tracking-wide mb-2">Style</p>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {POLAROID_STYLES.map(({ id, label }) => (
          <ToggleButton
            key={id}
            active={border.style === id}
            onClick={() => update({ style: id })}
            label={label}
          />
        ))}
      </div>

      <p className="text-xs font-semibold text-bark-muted uppercase tracking-wide mb-2">Decoration</p>
      <div className="grid grid-cols-3 gap-2">
        {POLAROID_DECORATIONS.map(({ id, label }) => (
          <ToggleButton
            key={id}
            active={border.decoration === id}
            onClick={() => update({ decoration: id })}
            label={label}
          />
        ))}
      </div>
    </div>
  )
}

function ToggleButton({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`py-2 rounded-xl border text-xs font-medium transition-colors ${
        active
          ? 'border-kaydo bg-kaydo/10 text-kaydo'
          : 'border-cream-dark bg-cream hover:border-kaydo hover:bg-kaydo/5 text-bark-light hover:text-kaydo'
      }`}
    >
      {label}
    </button>
  )
}

const PREVIEW_WIDTH_PX = {
  thin: { frame: 5, captionBottom: 24 },
  medium: { frame: 8, captionBottom: 32 },
  thick: { frame: 12, captionBottom: 44 },
}

function BorderPreview({ border }) {
  const preset = PREVIEW_WIDTH_PX[border.width] || PREVIEW_WIDTH_PX.medium
  const lightFrame = isLightPolaroidColor(border.color)
  const contrast = lightFrame ? 'rgba(45, 27, 14, 0.45)' : 'rgba(253, 246, 236, 0.55)'
  const captionColor = lightFrame ? '#2D1B0E' : '#FDF6EC'
  const innerBorder =
    border.style === 'dashed'
      ? `1.5px dashed ${contrast}`
      : border.style === 'double'
        ? `3px double ${contrast}`
        : 'none'

  return (
    <div
      className="relative shadow-lg"
      style={{
        backgroundColor: border.color,
        paddingTop: preset.frame,
        paddingLeft: preset.frame,
        paddingRight: preset.frame,
        paddingBottom: preset.captionBottom,
        width: 110,
        transform: 'rotate(-1.2deg)',
      }}
    >
      {border.decoration === 'tape' && (
        <div
          className="absolute pointer-events-none"
          style={{
            top: -5,
            left: '50%',
            width: 36,
            height: 10,
            backgroundColor: 'rgba(254, 240, 138, 0.78)',
            transform: 'translateX(-50%) rotate(-4deg)',
          }}
        />
      )}
      <div className="relative" style={{ aspectRatio: '1 / 1', backgroundColor: 'hsl(30, 30%, 80%)' }}>
        {innerBorder !== 'none' && (
          <div className="absolute inset-0 pointer-events-none" style={{ border: innerBorder }} />
        )}
        {border.decoration === 'corners' && (
          <>
            <span
              className="absolute top-0 left-0"
              style={{ width: 9, height: 9, background: 'rgba(0,0,0,0.4)', clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
            />
            <span
              className="absolute top-0 right-0"
              style={{ width: 9, height: 9, background: 'rgba(0,0,0,0.4)', clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }}
            />
            <span
              className="absolute bottom-0 left-0"
              style={{ width: 9, height: 9, background: 'rgba(0,0,0,0.4)', clipPath: 'polygon(0 0, 0 100%, 100% 100%)' }}
            />
            <span
              className="absolute bottom-0 right-0"
              style={{ width: 9, height: 9, background: 'rgba(0,0,0,0.4)', clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
            />
          </>
        )}
      </div>
      <p
        className="absolute left-0 right-0 text-center text-[8px] font-display tracking-wide"
        style={{ bottom: 6, color: captionColor }}
      >
        Memory
      </p>
    </div>
  )
}

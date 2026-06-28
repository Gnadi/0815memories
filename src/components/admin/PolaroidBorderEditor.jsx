import { useTranslation } from 'react-i18next'
import { Camera } from 'lucide-react'
import {
  POLAROID_COLORS,
  POLAROID_WIDTHS,
  POLAROID_STYLES,
  POLAROID_DECORATIONS,
  POLAROID_FRAME_THEMES,
  resolvePolaroidBorder,
  isLightPolaroidColor,
  getPolaroidFramePattern,
} from '../home/polaroidBorder'
import UploadWidget from './UploadWidget'

export default function PolaroidBorderEditor({ value, onChange }) {
  const { t } = useTranslation('memory')
  const border = resolvePolaroidBorder(value)
  const update = (patch) => onChange({ ...border, ...patch })

  return (
    <div className="rounded-2xl border border-cream-dark p-4 bg-cream/40">
      <div className="flex items-center gap-1.5 mb-3">
        <Camera className="w-4 h-4 text-kaydo" />
        <p className="text-sm font-semibold text-bark">{t('polaroid.heading')}</p>
      </div>
      <p className="text-xs text-bark-muted mb-4">
        {t('polaroid.intro')}
      </p>

      <div className="flex justify-center mb-4">
        <BorderPreview border={border} />
      </div>

      <p className="text-xs font-semibold text-bark-muted uppercase tracking-wide mb-2">{t('polaroid.theme')}</p>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {POLAROID_FRAME_THEMES.map(({ id }) => (
          <ToggleButton
            key={id}
            active={border.frameTheme === id}
            onClick={() => update({ frameTheme: id })}
            label={t('polaroid.themes.' + id)}
          />
        ))}
      </div>
      {border.frameTheme === 'custom' && (
        <div className="mb-3">
          <p className="text-xs text-bark-muted mb-2">
            {t('polaroid.customHint')}
          </p>
          <UploadWidget
            unencrypted
            currentUrl={border.customImageUrl}
            onUpload={(url, publicId) =>
              update({ customImageUrl: url, customImagePublicId: publicId })
            }
          />
        </div>
      )}

      <p className="text-xs font-semibold text-bark-muted uppercase tracking-wide mb-2">{t('polaroid.color')}</p>
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
            aria-label={t('polaroid.borderColorAria', { color })}
            aria-pressed={border.color === color}
          />
        ))}
      </div>

      <p className="text-xs font-semibold text-bark-muted uppercase tracking-wide mb-2">{t('polaroid.width')}</p>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {POLAROID_WIDTHS.map(({ id }) => (
          <ToggleButton
            key={id}
            active={border.width === id}
            onClick={() => update({ width: id })}
            label={t('polaroid.widths.' + id)}
          />
        ))}
      </div>

      <p className="text-xs font-semibold text-bark-muted uppercase tracking-wide mb-2">{t('polaroid.style')}</p>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {POLAROID_STYLES.map(({ id }) => (
          <ToggleButton
            key={id}
            active={border.style === id}
            onClick={() => update({ style: id })}
            label={t('polaroid.styles.' + id)}
          />
        ))}
      </div>

      <p className="text-xs font-semibold text-bark-muted uppercase tracking-wide mb-2">{t('polaroid.decoration')}</p>
      <div className="grid grid-cols-3 gap-2">
        {POLAROID_DECORATIONS.map(({ id }) => (
          <ToggleButton
            key={id}
            active={border.decoration === id}
            onClick={() => update({ decoration: id })}
            label={t('polaroid.decorations.' + id)}
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
  thin: { frame: 5, captionBottom: 36 },
  medium: { frame: 8, captionBottom: 40 },
  thick: { frame: 12, captionBottom: 50 },
}

function BorderPreview({ border }) {
  const { t } = useTranslation('memory')
  const preset = PREVIEW_WIDTH_PX[border.width] || PREVIEW_WIDTH_PX.medium
  const framePattern = getPolaroidFramePattern(border)
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
      {framePattern && (
        <div
          className="absolute left-0 right-0 top-0 pointer-events-none"
          style={{ ...framePattern, bottom: preset.captionBottom }}
          aria-hidden="true"
        />
      )}
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
            zIndex: 2,
          }}
        />
      )}
      <div className="relative" style={{ aspectRatio: '1 / 1', backgroundColor: 'hsl(30, 30%, 80%)', zIndex: 1 }}>
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
        {t('polaroid.previewCaption')}
      </p>
    </div>
  )
}

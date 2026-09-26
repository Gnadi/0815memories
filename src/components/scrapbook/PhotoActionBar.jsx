import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import EncryptedImage from '../media/EncryptedImage'
import { FILTER_PRESETS, FRAME_COLORS, MAX_FRAME_WIDTH, filterCss } from './photoStyle'
import {
  Check,
  Camera,
  Replace,
  Crop,
  Expand,
  PanelBottom,
  Palette,
  RotateCw,
  FlipHorizontal2,
  ImageOff,
  Trash2,
} from 'lucide-react'

/**
 * Contextual bottom bar shown when a filled photo element is selected.
 * Mirrors the reference action strip:
 * Done · Change · Swap · Crop · Polaroid · Style · Flip
 * where "Style" holds three tabs: Filter · Frame · Rotate.
 * Plus two destructive actions: Remove picture (keep slot empty) and Remove.
 *
 * Props:
 *  - element: the selected photo element
 *  - onDone()
 *  - onChange()                  → triggers PhotoBar "replace" mode
 *  - onSwap()                    → triggers PhotoBar "swap" mode
 *  - onRotate()                  → 90° step clockwise
 *  - onStyle(updates)            → { rotation } | { filter } | { borderWidth, borderColor } | { cornerRadius }
 *  - onFlip()
 *  - onScale(newScale)           → 0.5..3
 *  - onCrop(updates)             → { offsetX, offsetY, fit, imageScale } for the crop panel
 *  - onPolaroid(on)              → white polaroid border on / off
 *  - onCaption(text)             → the line written under a polaroid
 *  - panel / onTogglePanel(id)   → which panel is open:
 *                                  'crop' | 'polaroid' | 'style' | null.
 *                                  While 'crop' is open, dragging the photo pans
 *                                  it inside its frame
 *  - onRemovePicture()           → clears url, keeps slot
 *  - onRemove()                  → deletes the element
 *  - mode: 'idle' | 'replace' | 'swap' (to highlight active action)
 */
export default function PhotoActionBar({
  element,
  onDone,
  onChange,
  onSwap,
  onRotate,
  onStyle,
  onFlip,
  onScale,
  onCrop,
  onPolaroid,
  onCaption,
  panel = null,
  onTogglePanel,
  onRemovePicture,
  onRemove,
  mode = 'idle',
}) {
  const { t } = useTranslation('scrapbook')
  const currentScale = element?.imageScale || 1
  const isFit = element?.fit === 'contain'
  const isPolaroid = !!element?.polaroid
  const cropOpen = panel === 'crop'
  // Which part of the "Style" panel is showing; filters are what people reach
  // for first.
  const [styleTab, setStyleTab] = useState('filter')
  const rotation = normaliseAngle(element?.rotation || 0)
  const borderWidth = element?.borderWidth || 0
  const borderColor = element?.borderColor || FRAME_COLORS[0]
  const cornerRadius = typeof element?.cornerRadius === 'number' ? element.cornerRadius : 0
  const currentFilter = element?.filter || 'none'

  // Turning the border on opens the caption field straight away — writing the
  // line underneath is the reason to want a polaroid.
  const handlePolaroidAction = () => {
    if (!isPolaroid) {
      onPolaroid?.(true)
      if (panel !== 'polaroid') onTogglePanel?.('polaroid')
      return
    }
    onTogglePanel?.('polaroid')
  }

  const actions = [
    { id: 'done', icon: Check, label: t('photoActions.done'), onClick: onDone, primary: true },
    { id: 'change', icon: Camera, label: t('photoActions.change'), onClick: onChange, active: mode === 'replace' },
    { id: 'swap', icon: Replace, label: t('photoActions.swap'), onClick: onSwap, active: mode === 'swap' },
    { id: 'crop', icon: Crop, label: t('photoActions.crop'), onClick: () => onTogglePanel?.('crop'), active: cropOpen },
    { id: 'polaroid', icon: PanelBottom, label: t('photoActions.polaroid'), onClick: handlePolaroidAction, active: isPolaroid || panel === 'polaroid' },
    { id: 'style', icon: Palette, label: t('photoActions.style'), onClick: () => onTogglePanel?.('style'), active: panel === 'style' },
    { id: 'flip', icon: FlipHorizontal2, label: t('photoActions.flip'), onClick: onFlip },
    { id: 'remove-picture', icon: ImageOff, label: t('photoActions.clear'), onClick: onRemovePicture, variant: 'warn' },
    { id: 'remove', icon: Trash2, label: t('photoActions.remove'), onClick: onRemove, variant: 'danger' },
  ]

  return (
    <div className="bg-warm-white border-t border-cream-dark">
      {cropOpen && (
        <div className="px-4 pt-3 pb-1 space-y-2">
          <p className="text-[11px] text-bark-muted">{t('photoActions.cropHint')}</p>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium text-bark-muted whitespace-nowrap w-10">{t('photoActions.zoom')}</span>
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.05}
              value={currentScale}
              disabled={isFit}
              onChange={(e) => onScale?.(parseFloat(e.target.value))}
              aria-label={t('photoActions.zoom')}
              className="flex-1 accent-kaydo disabled:opacity-40"
            />
            <span className="text-[11px] font-mono text-bark-light w-12 text-right">
              {isFit ? '—' : `${currentScale.toFixed(2)}×`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium text-bark-muted w-10" aria-hidden="true">↔</span>
            <input
              type="range" min={-1} max={1} step={0.02}
              value={element?.offsetX || 0}
              onChange={(e) => onCrop?.({ offsetX: parseFloat(e.target.value) })}
              aria-label={t('photoActions.panHorizontal')}
              className="flex-1 accent-kaydo"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium text-bark-muted w-10" aria-hidden="true">↕</span>
            <input
              type="range" min={-1} max={1} step={0.02}
              value={element?.offsetY || 0}
              onChange={(e) => onCrop?.({ offsetY: parseFloat(e.target.value) })}
              aria-label={t('photoActions.panVertical')}
              className="flex-1 accent-kaydo"
            />
          </div>
          <div className="flex items-center gap-4 pt-1">
            <button
              type="button"
              onClick={() => onCrop?.(isFit ? { fit: null } : { fit: 'contain', offsetX: 0, offsetY: 0 })}
              aria-pressed={isFit}
              className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                isFit ? 'bg-kaydo text-white border-kaydo' : 'border-cream-dark text-bark hover:bg-cream'
              }`}
            >
              <Expand className="w-3.5 h-3.5" />
              {t('photoActions.fitWhole')}
            </button>
            <button
              type="button"
              onClick={() => onCrop?.({ imageScale: 1, offsetX: 0, offsetY: 0, fit: null })}
              className="text-[11px] font-medium text-kaydo hover:text-kaydo-dark"
            >
              {t('photoActions.reset')}
            </button>
          </div>
        </div>
      )}

      {panel === 'polaroid' && (
        <div className="px-4 pt-3 pb-1 space-y-2">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={element?.caption || ''}
              onChange={(e) => onCaption?.(e.target.value)}
              disabled={!isPolaroid}
              maxLength={60}
              placeholder={t('photoActions.captionPlaceholder')}
              aria-label={t('photoActions.caption')}
              className="flex-1 min-w-0 px-3 py-2 bg-cream-dark rounded-xl text-sm text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => onPolaroid?.(!isPolaroid)}
              aria-pressed={isPolaroid}
              className={`flex-shrink-0 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                isPolaroid ? 'bg-kaydo text-white border-kaydo' : 'border-cream-dark text-bark hover:bg-cream'
              }`}
            >
              {isPolaroid ? t('photoActions.polaroidOn') : t('photoActions.polaroidOff')}
            </button>
          </div>
        </div>
      )}

      {panel === 'style' && (
        <div className="px-4 pt-3" role="tablist" aria-label={t('photoActions.style')}>
          <div className="flex gap-1 p-1 bg-cream rounded-xl">
            {STYLE_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={styleTab === tab}
                onClick={() => setStyleTab(tab)}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                  styleTab === tab ? 'bg-warm-white text-bark shadow-sm' : 'text-bark-muted hover:text-bark'
                }`}
              >
                {t(`photoActions.${tab}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      {panel === 'style' && styleTab === 'rotate' && (
        <div className="px-4 pt-3 pb-1 space-y-2">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              value={rotation}
              onChange={(e) => onStyle?.({ rotation: parseInt(e.target.value, 10) })}
              aria-label={t('photoActions.angle')}
              className="flex-1 accent-kaydo"
            />
            <span className="text-[11px] font-mono text-bark-light w-10 text-right">{rotation}°</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onRotate}
              className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border border-cream-dark text-bark hover:bg-cream"
            >
              <RotateCw className="w-3.5 h-3.5" />
              {t('photoActions.rotate90')}
            </button>
            <button
              type="button"
              onClick={() => onStyle?.({ rotation: 0 })}
              className="text-[11px] font-medium text-kaydo hover:text-kaydo-dark"
            >
              {t('photoActions.straighten')}
            </button>
          </div>
        </div>
      )}

      {panel === 'style' && styleTab === 'filter' && (
        <div className="flex gap-2 overflow-x-auto hide-scrollbar px-4 pt-3 pb-1">
          {FILTER_PRESETS.map((preset) => {
            const selected = currentFilter === preset.id
            const css = filterCss(preset.id)
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onStyle?.({ filter: preset.id === 'none' ? null : preset.id })}
                aria-pressed={selected}
                className="flex-shrink-0 flex flex-col items-center gap-1"
              >
                <span
                  className={`relative block w-14 h-14 rounded-xl overflow-hidden border-2 ${
                    selected ? 'border-kaydo' : 'border-transparent'
                  }`}
                >
                  {element?.url && (
                    <EncryptedImage
                      src={element.url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      style={css ? { filter: css } : undefined}
                    />
                  )}
                </span>
                <span className={`text-[10px] font-medium ${selected ? 'text-kaydo' : 'text-bark-muted'}`}>
                  {t(`photoActions.filters.${preset.id}`)}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {panel === 'style' && styleTab === 'frame' && (
        <div className="pt-3 pb-1 space-y-2">
          <div className="flex gap-2 overflow-x-auto hide-scrollbar px-4">
            {FRAME_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                aria-pressed={borderWidth > 0 && borderColor === color}
                // Picking a colour on a frameless photo gives it a frame to show it on.
                onClick={() => onStyle?.({ borderColor: color, borderWidth: borderWidth || 6 })}
                className={`flex-shrink-0 w-8 h-8 rounded-full border-2 transition-transform active:scale-95 ${
                  borderWidth > 0 && borderColor === color ? 'border-kaydo scale-110' : 'border-cream-dark'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 px-4">
            <span className="text-[11px] font-medium text-bark-muted w-14 flex-shrink-0">{t('photoActions.thickness')}</span>
            <input
              type="range"
              min={0}
              max={MAX_FRAME_WIDTH}
              step={1}
              value={borderWidth}
              onChange={(e) => onStyle?.({ borderWidth: parseInt(e.target.value, 10) })}
              aria-label={t('photoActions.thickness')}
              className="flex-1 accent-kaydo"
            />
            <span className="text-[11px] font-mono text-bark-light w-10 text-right">{borderWidth}px</span>
          </div>
          <div className="flex items-center gap-3 px-4">
            <span className="text-[11px] font-medium text-bark-muted w-14 flex-shrink-0">{t('photoActions.corners')}</span>
            <input
              type="range"
              min={0}
              max={0.5}
              step={0.01}
              value={cornerRadius}
              onChange={(e) => onStyle?.({ cornerRadius: parseFloat(e.target.value) })}
              aria-label={t('photoActions.corners')}
              className="flex-1 accent-kaydo"
            />
            <span className="text-[11px] font-mono text-bark-light w-10 text-right">{Math.round(cornerRadius * 200)}%</span>
          </div>
        </div>
      )}

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
                    : variant === 'warn'
                      ? 'text-bark-light hover:bg-cream'
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

const STYLE_TABS = ['filter', 'frame', 'rotate']

// The slider runs from −180° to 180°; stored angles can be anything (the 90°
// button counts up to 270°).
function normaliseAngle(deg) {
  const a = ((Math.round(deg) % 360) + 360) % 360
  return a > 180 ? a - 360 : a
}

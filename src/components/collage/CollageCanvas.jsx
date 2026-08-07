import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import CollagePreview from './CollagePreview'
import { ASPECTS, DEFAULT_ASPECT, getTemplate } from './collageTemplates'

// CSS mirror of the canvas shapes — used only for the selection ring and the
// hit area, never for the photo itself (the canvas draws that).
function cssRadius(slot, border) {
  if (slot.shape === 'circle') return '50%'
  if (slot.shape === 'pill') return '9999px'
  if (slot.shape === 'rect') return '0'
  // An arch is round on top, square at the bottom.
  if (slot.shape === 'arch') return '50% 50% 0 0 / 32% 32% 0 0'
  return `${Math.round((slot.radius ?? border?.radius ?? 0.08) * 100)}%`
}

/**
 * The collage editor's canvas: the rendered collage plus one tap target per
 * slot. Empty slots show the round "+" from the reference design; filled slots
 * are selectable and show a ring.
 */
export default function CollageCanvas({
  doc,
  selectedSlotId,
  onSelectSlot,
  onAddPhoto,
  swapSourceId = null,
}) {
  const { t } = useTranslation('collage')
  const template = getTemplate(doc?.templateId)
  const ratio = ASPECTS[doc?.aspect || template.aspect] ?? ASPECTS[DEFAULT_ASPECT]

  return (
    // Fits the space between the toolbars in both directions: the width is
    // capped, and max-height shrinks it further on a tall phone rather than
    // letting a portrait collage run off under the photo bar.
    <div
      className="relative"
      style={{
        touchAction: 'manipulation',
        aspectRatio: String(ratio),
        width: 'min(100%, 32rem)',
        maxHeight: '100%',
      }}
    >
      <CollagePreview
        doc={doc}
        fit="box"
        className="w-full h-full rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(45,27,14,0.18)]"
      />

      <div className="absolute inset-0">
        {template.slots.map((slot) => {
          const fill = doc?.slots?.find((s) => s.id === slot.id)
          const isEmpty = !fill?.url
          const isSelected = selectedSlotId === slot.id
          const isSwapTarget = swapSourceId && swapSourceId !== slot.id && !isEmpty

          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => (isEmpty ? onAddPhoto?.(slot.id) : onSelectSlot?.(slot.id))}
              aria-label={isEmpty ? t('editor.addPhotoToSlot') : t('editor.selectPhoto')}
              className="absolute flex items-center justify-center transition-shadow"
              style={{
                left: `${slot.x * 100}%`,
                top: `${slot.y * 100}%`,
                width: `${slot.w * 100}%`,
                height: `${slot.h * 100}%`,
                transform: slot.rotation ? `rotate(${slot.rotation}deg)` : undefined,
                // Matches the renderer: a slot with a pivot turns about that
                // point (the film strip's centre), not about its own.
                transformOrigin: slot.rotation && slot.pivot
                  ? `${((slot.pivot[0] - slot.x) / slot.w) * 100}% ${((slot.pivot[1] - slot.y) / slot.h) * 100}%`
                  : undefined,
                borderRadius: cssRadius(slot, doc?.border),
                boxShadow: isSelected
                  ? '0 0 0 3px var(--color-kaydo)'
                  : isSwapTarget
                    ? '0 0 0 2px rgba(194,90,46,0.65)'
                    : 'none',
              }}
            >
              {isEmpty && (
                <span className="w-11 h-11 rounded-full bg-kaydo text-white flex items-center justify-center shadow-lg">
                  <Plus className="w-6 h-6" strokeWidth={2.5} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

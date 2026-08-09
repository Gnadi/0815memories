import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { COLLAGE_TEMPLATES, aspectRatioOf, fillTemplate } from './collageTemplates'
import CollagePreview from './CollagePreview'

/**
 * The scrollable template picker at the bottom of the editor. Each thumbnail is
 * the real renderer filled with the collage's own photos, so switching template
 * shows what you are actually going to get.
 *
 * Every thumbnail stands on the same fixed height and takes its width from its
 * own ratio. Sizing it the other way round — a fixed width, height following —
 * let the one 9:16 template set the height of the whole row and stole space
 * from the canvas above, while leaving the common 4:5 thumbnails small.
 */
export default function TemplateStrip({ activeTemplateId, photos = [], onSelect }) {
  const { t } = useTranslation('collage')

  const previews = useMemo(
    () => COLLAGE_TEMPLATES.map((template) => ({
      template,
      doc: fillTemplate(template, photos.slice(0, 6)),
    })),
    [photos]
  )

  return (
    <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar px-4 py-3">
      {previews.map(({ template, doc }) => {
        const active = template.id === activeTemplateId
        return (
          <button
            key={template.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect?.(template.id)}
            className={`flex-shrink-0 h-28 sm:h-32 transition-transform active:scale-95 ${active ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
          >
            {/* With the caption gone, the ring is the only selection signal. */}
            <CollagePreview
              doc={doc}
              preferThumbs
              fit="box"
              className={`rounded-xl overflow-hidden border-2 ${active ? 'border-kaydo ring-2 ring-kaydo' : 'border-cream-dark'}`}
              style={{ aspectRatio: String(aspectRatioOf(doc)), height: '100%', width: 'auto' }}
            />
            <span className="sr-only">{t(template.labelKey)}</span>
          </button>
        )
      })}
    </div>
  )
}

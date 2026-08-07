import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { COLLAGE_TEMPLATES, fillTemplate } from './collageTemplates'
import CollagePreview from './CollagePreview'

/**
 * The scrollable template picker at the bottom of the editor. Each thumbnail is
 * the real renderer filled with the collage's own photos, so switching template
 * shows what you are actually going to get.
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
    <div className="flex gap-3 overflow-x-auto hide-scrollbar px-4 py-3">
      {previews.map(({ template, doc }) => {
        const active = template.id === activeTemplateId
        return (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect?.(template.id)}
            className={`flex-shrink-0 w-20 text-left transition-transform active:scale-95 ${active ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`}
          >
            <CollagePreview
              doc={doc}
              preferThumbs
              className={`w-20 rounded-lg overflow-hidden border-2 ${active ? 'border-kaydo' : 'border-cream-dark'}`}
            />
            <span className={`block mt-1 text-[10px] leading-tight truncate ${active ? 'text-kaydo font-semibold' : 'text-bark-muted'}`}>
              {t(template.labelKey)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

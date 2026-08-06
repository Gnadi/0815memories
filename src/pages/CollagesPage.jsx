import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Loader2, LayoutGrid, Trash2, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/layout/Sidebar'
import MobileHeader from '../components/layout/MobileHeader'
import CollagePreview from '../components/collage/CollagePreview'
import { COLLAGE_TEMPLATES, aspectRatioOf, fillTemplate, makeCollageDoc } from '../components/collage/collageTemplates'
import { useCollages } from '../hooks/useCollages'
import { useMemoryPhotos } from '../hooks/useMemoryPhotos'
import { devError } from '../utils/devLog'

// Templates come in several shapes; sizing each tile by its own ratio leaves
// every row ragged and the labels unaligned. Instead every tile gets the same
// stage height and the collage is sized *from that height*, so a portrait
// template still looks portrait — a square-ish crop would misrepresent it in
// the very screen where the customer picks a shape.
//
// No card, no border: the artwork is the thing being chosen, and a frame drawn
// around a template that already has its own frame just reads as noise.
function PreviewTile({ doc }) {
  return (
    <div className="h-52 sm:h-64 lg:h-72 flex items-center justify-center">
      <CollagePreview
        doc={doc}
        preferThumbs
        fit="box"
        className="rounded-2xl overflow-hidden shadow-[0_6px_20px_rgba(45,27,14,0.12)]"
        style={{
          aspectRatio: String(aspectRatioOf(doc)),
          height: '100%',
          width: 'auto',
          maxWidth: '100%',
        }}
      />
    </div>
  )
}

export default function CollagesPage() {
  const { t } = useTranslation('collage')
  const navigate = useNavigate()
  const { familyId, encryptionKey, isAdmin } = useAuth()

  const { collages, loading, addCollage, deleteCollage } =
    useCollages(familyId, encryptionKey, { withDoc: true })
  const { photos } = useMemoryPhotos(familyId, encryptionKey)

  const [creating, setCreating] = useState(null)
  const [error, setError] = useState(null)

  // Template cards are previewed with the family's own recent photos — far more
  // inviting than grey boxes, and it shows how a layout treats real pictures.
  const previewPhotos = useMemo(
    () => photos.slice(0, 6).map((p) => ({ url: p.url, thumbUrl: p.thumbUrl })),
    [photos]
  )

  const handleCreate = async (template) => {
    if (!familyId) { setError(t('errors.notAuthenticated')); return }
    setCreating(template.id)
    setError(null)
    try {
      const id = await addCollage({
        title: t('defaultTitle'),
        templateId: template.id,
        doc: makeCollageDoc(template),
      })
      navigate(`/collage/${id}`)
    } catch (err) {
      devError('Failed to create collage', err)
      setError(t('errors.createFailed'))
      setCreating(null)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8 max-w-6xl w-full mx-auto">
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Warm header */}
          <header
            className="rounded-3xl border border-cream-dark px-5 py-5 sm:px-8 sm:py-6"
            style={{ background: 'linear-gradient(135deg, #FFFDF9 0%, #FDF1E4 55%, #FAE2D1 100%)' }}
          >
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-kaydo">
              <Sparkles className="w-3.5 h-3.5" />
              {t('collages.eyebrow')}
            </span>
            <h1 className="mt-2.5 text-3xl sm:text-[2.6rem] leading-tight font-bold text-bark">
              {t('collages.title')}
            </h1>
          </header>

          {/* Templates */}
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-bark-muted mb-4">
              {t('collages.templatesHeading')}
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
              {COLLAGE_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  disabled={!isAdmin || creating != null}
                  onClick={() => handleCreate(template)}
                  className="group text-left transition-transform hover:-translate-y-1 active:scale-[0.98] disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  <PreviewTile doc={fillTemplate(template, previewPhotos)} />
                  <span className="flex items-center justify-center gap-1.5 pt-2.5 text-sm font-medium text-bark group-hover:text-kaydo">
                    {creating === template.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {t(template.labelKey)}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Saved collages */}
          <section className="mt-10">
            <div className="flex items-baseline gap-2 mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-bark-muted">
                {t('collages.yoursHeading')}
              </h2>
              {collages.length > 0 && (
                <span className="text-[11px] font-semibold text-kaydo bg-kaydo/10 rounded-full px-2 py-0.5">
                  {collages.length}
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-kaydo" />
              </div>
            ) : collages.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-cream-dark bg-warm-white/60 px-6 py-10 text-center">
                <div className="w-14 h-14 rounded-full bg-cream-dark/60 flex items-center justify-center mx-auto mb-3">
                  <LayoutGrid className="w-7 h-7 text-bark-muted" />
                </div>
                <p className="text-sm text-bark-muted max-w-xs mx-auto leading-relaxed">
                  {t('collages.empty')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
                {collages.map((collage) => (
                  <div key={collage.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => navigate(`/collage/${collage.id}`)}
                      className="w-full text-left transition-transform hover:-translate-y-1 active:scale-[0.98]"
                    >
                      <PreviewTile doc={collage.doc} />
                      <span className="block pt-2.5 text-sm font-medium text-bark text-center truncate">
                        {collage.title || t('defaultTitle')}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCollage(collage.id)}
                      aria-label={t('editor.delete')}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-warm-white/95 text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center shadow-md"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

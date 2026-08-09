import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Loader2, LayoutGrid, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/layout/Sidebar'
import MobileHeader from '../components/layout/MobileHeader'
import CollagePreview from '../components/collage/CollagePreview'
import GalleryRail from '../components/collage/GalleryRail'
import GalleryStage from '../components/collage/GalleryStage'
import { CARD_FOCUS, CARD_MOTION, railItemClass } from '../components/collage/galleryLayout'
import { COLLAGE_TEMPLATES, aspectRatioOf, fillTemplate, makeCollageDoc } from '../components/collage/collageTemplates'
import { useCollages } from '../hooks/useCollages'
import { useMemoryPhotos } from '../hooks/useMemoryPhotos'
import { devError } from '../utils/devLog'

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

          {/* The gallery's own title card: scale and centring carry it, so no
              panel, no border, no kicker competing with the artwork below. */}
          <header className="pt-2 pb-7 text-center sm:pt-8 sm:pb-10">
            <h1 className="text-[2.75rem] leading-[1.05] font-bold tracking-tight text-bark sm:text-6xl lg:text-7xl">
              {t('collages.title')}
            </h1>
            <h2 className="mt-3 text-base text-bark-muted sm:text-lg">
              {t('collages.templatesHeading')}
            </h2>
          </header>

          {/* Templates */}
          <section>
            <GalleryRail>
              {COLLAGE_TEMPLATES.map((template) => {
                const doc = fillTemplate(template, previewPhotos)
                const busy = creating === template.id
                return (
                  <button
                    key={template.id}
                    type="button"
                    disabled={!isAdmin || creating != null}
                    aria-busy={busy}
                    onClick={() => handleCreate(template)}
                    className={`${railItemClass()} ${CARD_MOTION} ${CARD_FOCUS} relative disabled:opacity-60 disabled:hover:translate-y-0`}
                  >
                    <GalleryStage
                      ratio={aspectRatioOf(doc)}
                      className="rounded-3xl overflow-hidden shadow-[0_10px_34px_rgba(45,27,14,0.14)]"
                    >
                      <CollagePreview doc={doc} preferThumbs fit="box" className="w-full h-full" />
                    </GalleryStage>
                    {/* The artwork is the label; the name is still announced. */}
                    <span className="sr-only">{t(template.labelKey)}</span>
                    {busy && (
                      <span className="absolute inset-0 grid place-items-center rounded-3xl bg-warm-white/70">
                        <Loader2 className="w-8 h-8 animate-spin text-kaydo" />
                      </span>
                    )}
                  </button>
                )
              })}
            </GalleryRail>
          </section>

          {/* Saved collages */}
          <section className="mt-6 sm:mt-10">
            <div className="flex items-center justify-center gap-2 mb-4">
              <h2 className="text-2xl font-semibold text-bark sm:text-3xl">
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
              <GalleryRail variant="list">
                {collages.map((collage) => (
                  <div key={collage.id} className={`${railItemClass('list')} group relative`}>
                    <button
                      type="button"
                      onClick={() => navigate(`/collage/${collage.id}`)}
                      className={`w-full ${CARD_MOTION} ${CARD_FOCUS}`}
                    >
                      <GalleryStage
                        ratio={aspectRatioOf(collage.doc)}
                        size="list"
                        className="rounded-2xl overflow-hidden shadow-[0_6px_20px_rgba(45,27,14,0.12)]"
                      >
                        <CollagePreview doc={collage.doc} preferThumbs fit="box" className="w-full h-full" />
                      </GalleryStage>
                      <span className="block pt-2.5 text-sm font-medium text-bark text-center truncate">
                        {collage.title || t('defaultTitle')}
                      </span>
                    </button>
                    {/* Visible on touch, where there is no hover to reveal it. */}
                    <button
                      type="button"
                      onClick={() => deleteCollage(collage.id)}
                      aria-label={t('editor.delete')}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-warm-white/95 text-red-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 flex items-center justify-center shadow-md"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </GalleryRail>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Loader2, Film, LayoutGrid, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/layout/Sidebar'
import MobileHeader from '../components/layout/MobileHeader'
import EncryptedImage from '../components/media/EncryptedImage'
import CollagePreview from '../components/collage/CollagePreview'
import { COLLAGE_TEMPLATES, fillTemplate, makeCollageDoc } from '../components/collage/collageTemplates'
import { useCollages } from '../hooks/useCollages'
import { useHighlights } from '../hooks/useHighlights'
import { useHighlightSuggestions } from '../hooks/useHighlightSuggestions'
import { makeHighlightDoc } from '../utils/reelRenderer'
import { devError } from '../utils/devLog'

export default function CreatePage() {
  const { t, i18n } = useTranslation('collage')
  const navigate = useNavigate()
  const { familyId, encryptionKey, isAdmin } = useAuth()

  const { collages, loading: collagesLoading, addCollage, deleteCollage } = useCollages(familyId, encryptionKey, { withDoc: true })
  const { highlights, loading: highlightsLoading, addHighlight, deleteHighlight } = useHighlights(familyId, encryptionKey, { withDoc: true })
  const { suggestions, photos } = useHighlightSuggestions(familyId, encryptionKey)

  const [creating, setCreating] = useState(null)
  const [error, setError] = useState(null)

  // Template cards are previewed with the family's own recent photos — the same
  // trick the reference design uses, and far more inviting than grey boxes.
  const previewPhotos = useMemo(
    () => photos.slice(0, 6).map((p) => ({ url: p.url, thumbUrl: p.thumbUrl })),
    [photos]
  )

  const suggestionLabel = (suggestion) => {
    const { kind, params } = suggestion
    if (kind === 'year') return t('suggestions.year', { year: params.year })
    if (kind === 'season') return t(`suggestions.seasons.${params.season}`)
    if (kind === 'month') {
      const label = new Date(params.year, params.month, 1)
        .toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })
      return t('suggestions.month', { month: label })
    }
    return t('suggestions.recent')
  }

  const handleCreateCollage = async (template) => {
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

  const handleCreateHighlight = async (suggestion) => {
    if (!familyId) { setError(t('errors.notAuthenticated')); return }
    setCreating(suggestion.id)
    setError(null)
    try {
      const label = suggestionLabel(suggestion)
      const id = await addHighlight({
        title: label,
        doc: makeHighlightDoc({ shots: suggestion.shots, title: label }),
      })
      navigate(`/highlight/${id}`)
    } catch (err) {
      devError('Failed to create highlight', err)
      setError(t('errors.createFailed'))
      setCreating(null)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-6 space-y-10">
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
          )}

          {/* ── Collages ─────────────────────────────────────────────── */}
          <section>
            <div className="rounded-3xl bg-bark px-5 py-6 sm:px-8 sm:py-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-warm-white">{t('hub.collagesTitle')}</h1>
              <p className="text-sm text-warm-white/70 mt-1">{t('hub.collagesSubtitle')}</p>

              <div className="flex gap-4 overflow-x-auto hide-scrollbar mt-5 -mx-1 px-1 pb-1">
                {COLLAGE_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    disabled={!isAdmin || creating != null}
                    onClick={() => handleCreateCollage(template)}
                    className="flex-shrink-0 w-40 sm:w-48 text-left disabled:opacity-60 transition-transform active:scale-[0.98]"
                  >
                    <CollagePreview
                      doc={fillTemplate(template, previewPhotos)}
                      preferThumbs
                      className="w-full rounded-2xl overflow-hidden shadow-lg"
                    />
                    <span className="flex items-center gap-1.5 mt-2 text-xs font-medium text-warm-white/90">
                      {creating === template.id && <Loader2 className="w-3 h-3 animate-spin" />}
                      {t(template.labelKey)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Saved collages */}
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-bark mb-3">{t('hub.yourCollages')}</h2>
              {collagesLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-kaydo" /></div>
              ) : collages.length === 0 ? (
                <p className="text-sm text-bark-muted">{t('hub.noCollages')}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {collages.map((collage) => (
                    <div key={collage.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => navigate(`/collage/${collage.id}`)}
                        className="w-full text-left"
                      >
                        <CollagePreview
                          doc={collage.doc}
                          preferThumbs
                          className="w-full rounded-2xl overflow-hidden border border-cream-dark shadow-sm"
                        />
                        <span className="block mt-1.5 text-xs font-medium text-bark truncate">
                          {collage.title || t('defaultTitle')}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteCollage(collage.id)}
                        aria-label={t('editor.delete')}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-warm-white/90 text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center shadow"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ── Highlight video ──────────────────────────────────────── */}
          <section>
            <div className="rounded-3xl bg-bark px-5 py-6 sm:px-8 sm:py-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-warm-white">{t('hub.highlightTitle')}</h1>
              <p className="text-sm text-warm-white/70 mt-1">{t('hub.highlightSubtitle')}</p>

              {suggestions.length === 0 ? (
                <p className="text-sm text-warm-white/60 mt-5">{t('hub.noSuggestions')}</p>
              ) : (
                <div className="flex gap-4 overflow-x-auto hide-scrollbar mt-5 -mx-1 px-1 pb-1">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      disabled={!isAdmin || creating != null}
                      onClick={() => handleCreateHighlight(suggestion)}
                      className="flex-shrink-0 w-40 sm:w-48 text-left disabled:opacity-60 transition-transform active:scale-[0.98]"
                    >
                      <div className="relative w-full aspect-[9/16] rounded-2xl overflow-hidden bg-black shadow-lg">
                        <EncryptedImage
                          src={suggestion.shots[0]?.url}
                          thumbSrc={suggestion.shots[0]?.thumbUrl || ''}
                          alt=""
                          className="w-full h-full object-cover opacity-80"
                        />
                        <span className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
                            {creating === suggestion.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Film className="w-3.5 h-3.5" />}
                            {suggestionLabel(suggestion)}
                          </span>
                          <span className="block text-[11px] text-white/70 mt-0.5">
                            {t('reel.shots', { count: suggestion.shots.length })}
                          </span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Saved highlight videos */}
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-bark mb-3">{t('hub.yourHighlights')}</h2>
              {highlightsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-kaydo" /></div>
              ) : highlights.length === 0 ? (
                <p className="text-sm text-bark-muted">{t('hub.noHighlights')}</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {highlights.map((highlight) => (
                    <div key={highlight.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => navigate(`/highlight/${highlight.id}`)}
                        className="w-full text-left"
                      >
                        <div className="w-full aspect-[9/16] rounded-2xl overflow-hidden bg-bark border border-cream-dark">
                          {highlight.doc?.shots?.[0]?.url ? (
                            <EncryptedImage
                              src={highlight.doc.shots[0].url}
                              thumbSrc={highlight.doc.shots[0].thumbUrl || ''}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <LayoutGrid className="w-6 h-6 text-warm-white/40" />
                            </div>
                          )}
                        </div>
                        <span className="block mt-1.5 text-xs font-medium text-bark truncate">
                          {highlight.title || t('reel.defaultTitle')}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteHighlight(highlight.id)}
                        aria-label={t('editor.delete')}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-warm-white/90 text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center shadow"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

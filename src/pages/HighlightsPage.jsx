import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Loader2, Film, Trash2, Play, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/layout/Sidebar'
import MobileHeader from '../components/layout/MobileHeader'
import EncryptedImage from '../components/media/EncryptedImage'
import { useHighlights } from '../hooks/useHighlights'
import { useHighlightSuggestions } from '../hooks/useHighlightSuggestions'
import { makeHighlightDoc } from '../utils/reelRenderer'
import { devError } from '../utils/devLog'

// Three photos from the reel, arranged as a little mosaic — a warmer, more
// honest preview than one dark full-bleed poster.
function ShotMosaic({ shots }) {
  const [first, second, third] = shots
  return (
    <div className="grid grid-cols-3 grid-rows-2 gap-1 h-32 sm:h-36">
      <div className="col-span-2 row-span-2 rounded-xl overflow-hidden bg-cream-dark">
        {first && <EncryptedImage src={first.url} thumbSrc={first.thumbUrl || ''} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="rounded-xl overflow-hidden bg-cream-dark">
        {second && <EncryptedImage src={second.url} thumbSrc={second.thumbUrl || ''} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="rounded-xl overflow-hidden bg-cream-dark">
        {third && <EncryptedImage src={third.url} thumbSrc={third.thumbUrl || ''} alt="" className="w-full h-full object-cover" />}
      </div>
    </div>
  )
}

export default function HighlightsPage() {
  const { t, i18n } = useTranslation('collage')
  const navigate = useNavigate()
  const { familyId, encryptionKey, isAdmin } = useAuth()

  const { highlights, loading, addHighlight, deleteHighlight } =
    useHighlights(familyId, encryptionKey, { withDoc: true })
  const { suggestions } = useHighlightSuggestions(familyId, encryptionKey)

  const [creating, setCreating] = useState(null)
  const [error, setError] = useState(null)

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

  const create = async (key, title, shots) => {
    if (!familyId) { setError(t('errors.notAuthenticated')); return }
    setCreating(key)
    setError(null)
    try {
      const id = await addHighlight({
        title,
        doc: makeHighlightDoc({ shots, title }),
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
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8 max-w-6xl w-full mx-auto">
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Warm header */}
          <header
            className="rounded-3xl border border-cream-dark px-5 py-7 sm:px-9 sm:py-9"
            style={{ background: 'linear-gradient(135deg, #FFFDF9 0%, #FBF0E6 50%, #F6E2D8 100%)' }}
          >
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-kaydo">
              <Film className="w-3.5 h-3.5" />
              {t('highlights.eyebrow')}
            </span>
            <h1 className="mt-2.5 text-3xl sm:text-[2.6rem] leading-tight font-bold text-bark">
              {t('highlights.title')}
            </h1>
            <p className="mt-2 text-sm sm:text-base text-bark-muted max-w-md leading-relaxed">
              {t('highlights.subtitle')}
            </p>
          </header>

          {/* Suggestions */}
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-bark-muted mb-4">
              {t('highlights.suggestionsHeading')}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  disabled={!isAdmin || creating != null}
                  onClick={() => create(suggestion.id, suggestionLabel(suggestion), suggestion.shots)}
                  className="group text-left rounded-2xl bg-warm-white border border-cream-dark p-2.5 shadow-[0_2px_10px_rgba(45,27,14,0.05)] transition-all hover:-translate-y-0.5 hover:border-kaydo/40 hover:shadow-[0_10px_24px_rgba(45,27,14,0.10)] disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  <ShotMosaic shots={suggestion.shots} />
                  <div className="flex items-center gap-2.5 px-1 pt-3 pb-1">
                    <span className="w-8 h-8 rounded-full bg-kaydo/10 text-kaydo flex items-center justify-center flex-shrink-0 group-hover:bg-kaydo group-hover:text-white transition-colors">
                      {creating === suggestion.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Play className="w-4 h-4 ml-0.5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-bark truncate">
                        {suggestionLabel(suggestion)}
                      </span>
                      <span className="block text-[11px] text-bark-muted">
                        {t('reel.shots', { count: suggestion.shots.length })}
                      </span>
                    </span>
                  </div>
                </button>
              ))}

              {/* Always available: build one by hand. */}
              <button
                type="button"
                disabled={!isAdmin || creating != null}
                onClick={() => create('blank', t('reel.defaultTitle'), [])}
                className="rounded-2xl border border-dashed border-cream-dark bg-warm-white/60 p-2.5 flex flex-col items-center justify-center gap-2 min-h-[11.5rem] text-bark-muted transition-colors hover:border-kaydo hover:text-kaydo hover:bg-kaydo/5 disabled:opacity-60"
              >
                {creating === 'blank'
                  ? <Loader2 className="w-7 h-7 animate-spin" />
                  : <Plus className="w-7 h-7" />}
                <span className="text-sm font-medium">{t('highlights.startBlank')}</span>
                <span className="text-[11px] px-6 text-center leading-relaxed">{t('highlights.startBlankHint')}</span>
              </button>
            </div>

            {suggestions.length === 0 && (
              <p className="mt-3 text-xs text-bark-muted">{t('highlights.noSuggestions')}</p>
            )}
          </section>

          {/* Saved reels */}
          <section className="mt-10">
            <div className="flex items-baseline gap-2 mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-bark-muted">
                {t('highlights.yoursHeading')}
              </h2>
              {highlights.length > 0 && (
                <span className="text-[11px] font-semibold text-kaydo bg-kaydo/10 rounded-full px-2 py-0.5">
                  {highlights.length}
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-kaydo" />
              </div>
            ) : highlights.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-cream-dark bg-warm-white/60 px-6 py-10 text-center">
                <div className="w-14 h-14 rounded-full bg-cream-dark/60 flex items-center justify-center mx-auto mb-3">
                  <Film className="w-7 h-7 text-bark-muted" />
                </div>
                <p className="text-sm text-bark-muted max-w-xs mx-auto leading-relaxed">
                  {t('highlights.empty')}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {highlights.map((highlight) => {
                  const shots = highlight.doc?.shots || []
                  return (
                    <div key={highlight.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => navigate(`/highlight/${highlight.id}`)}
                        className="w-full text-left rounded-2xl bg-warm-white border border-cream-dark p-2 shadow-[0_2px_10px_rgba(45,27,14,0.05)] transition-all hover:-translate-y-0.5 hover:border-kaydo/40 hover:shadow-[0_10px_24px_rgba(45,27,14,0.10)]"
                      >
                        <div className="w-full aspect-[4/5] rounded-xl overflow-hidden bg-cream-dark relative">
                          {shots[0]?.url ? (
                            <EncryptedImage
                              src={shots[0].url}
                              thumbSrc={shots[0].thumbUrl || ''}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Film className="w-6 h-6 text-bark-muted" />
                            </div>
                          )}
                          <span className="absolute bottom-2 left-2 w-8 h-8 rounded-full bg-warm-white/90 text-kaydo flex items-center justify-center shadow-sm">
                            <Play className="w-4 h-4 ml-0.5" />
                          </span>
                        </div>
                        <span className="block px-1 pt-2 text-xs font-medium text-bark truncate">
                          {highlight.title || t('reel.defaultTitle')}
                        </span>
                        <span className="block px-1 pb-1 text-[11px] text-bark-muted">
                          {t('reel.shots', { count: shots.length })}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteHighlight(highlight.id)}
                        aria-label={t('editor.delete')}
                        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-warm-white/95 border border-cream-dark text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center shadow-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

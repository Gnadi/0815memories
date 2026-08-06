import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Loader2, Film, Trash2, Play, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/layout/Sidebar'
import MobileHeader from '../components/layout/MobileHeader'
import EncryptedImage from '../components/media/EncryptedImage'
import { ASPECTS } from '../components/collage/collageTemplates'
import { useHighlights } from '../hooks/useHighlights'
import { useHighlightSuggestions } from '../hooks/useHighlightSuggestions'
import { makeHighlightDoc } from '../utils/reelRenderer'
import { devError } from '../utils/devLog'

// Every tile on this page stands on the same stage, the way the collage
// gallery does — no card, no border, just the artwork and a soft shadow.
const STAGE = 'h-52 sm:h-64 lg:h-72'

// Three photos from the reel: one large, two stacked beside it. A warmer, more
// honest preview than a single dark poster, and it shows the reel has more than
// one shot in it.
function ShotMosaic({ shots }) {
  const [first, second, third] = shots
  return (
    <div className={`${STAGE} grid grid-cols-3 grid-rows-2 gap-1.5`}>
      <div className="col-span-2 row-span-2 rounded-2xl overflow-hidden bg-cream-dark shadow-[0_6px_20px_rgba(45,27,14,0.12)]">
        {first && <EncryptedImage src={first.url} thumbSrc={first.thumbUrl || ''} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="rounded-2xl overflow-hidden bg-cream-dark shadow-[0_6px_20px_rgba(45,27,14,0.12)]">
        {second && <EncryptedImage src={second.url} thumbSrc={second.thumbUrl || ''} alt="" className="w-full h-full object-cover" />}
      </div>
      <div className="rounded-2xl overflow-hidden bg-cream-dark shadow-[0_6px_20px_rgba(45,27,14,0.12)]">
        {third && <EncryptedImage src={third.url} thumbSrc={third.thumbUrl || ''} alt="" className="w-full h-full object-cover" />}
      </div>
    </div>
  )
}

// A saved reel's poster: its first shot, in the shape that reel actually
// renders at (9:16 by default), fitted to the shared stage height.
function ReelPoster({ shot, aspect }) {
  const ratio = ASPECTS[aspect] ?? ASPECTS['9:16']
  return (
    <div className={`${STAGE} flex items-center justify-center`}>
      <div
        className="relative rounded-2xl overflow-hidden bg-cream-dark shadow-[0_6px_20px_rgba(45,27,14,0.12)]"
        style={{ aspectRatio: String(ratio), height: '100%', width: 'auto', maxWidth: '100%' }}
      >
        {shot?.url ? (
          <EncryptedImage src={shot.url} thumbSrc={shot.thumbUrl || ''} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-7 h-7 text-bark-muted" />
          </div>
        )}
        <span className="absolute bottom-2 left-2 w-9 h-9 rounded-full bg-warm-white/90 text-kaydo flex items-center justify-center shadow-sm">
          <Play className="w-4 h-4 ml-0.5" />
        </span>
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
            className="rounded-3xl border border-cream-dark px-5 py-5 sm:px-8 sm:py-6"
            style={{ background: 'linear-gradient(135deg, #FFFDF9 0%, #FBF0E6 50%, #F6E2D8 100%)' }}
          >
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-kaydo">
              <Film className="w-3.5 h-3.5" />
              {t('highlights.eyebrow')}
            </span>
            <h1 className="mt-2.5 text-3xl sm:text-[2.6rem] leading-tight font-bold text-bark">
              {t('highlights.title')}
            </h1>
          </header>

          {/* Suggestions */}
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-bark-muted mb-4">
              {t('highlights.suggestionsHeading')}
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  disabled={!isAdmin || creating != null}
                  onClick={() => create(suggestion.id, suggestionLabel(suggestion), suggestion.shots)}
                  className="group text-left transition-transform hover:-translate-y-1 active:scale-[0.98] disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  <ShotMosaic shots={suggestion.shots} />
                  <span className="flex items-center justify-center gap-1.5 pt-2.5 text-sm font-medium text-bark group-hover:text-kaydo">
                    {creating === suggestion.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Play className="w-3.5 h-3.5" />}
                    <span className="truncate">{suggestionLabel(suggestion)}</span>
                  </span>
                  <span className="block text-center text-[11px] text-bark-muted">
                    {t('reel.shots', { count: suggestion.shots.length })}
                  </span>
                </button>
              ))}

              {/* Always available: build one by hand. */}
              <button
                type="button"
                disabled={!isAdmin || creating != null}
                onClick={() => create('blank', t('reel.defaultTitle'), [])}
                className="group text-left transition-transform hover:-translate-y-1 active:scale-[0.98] disabled:opacity-60 disabled:hover:translate-y-0"
              >
                <span className={`${STAGE} rounded-2xl border-2 border-dashed border-cream-dark bg-warm-white/50 flex flex-col items-center justify-center gap-2 text-bark-muted transition-colors group-hover:border-kaydo group-hover:text-kaydo group-hover:bg-kaydo/5`}>
                  {creating === 'blank'
                    ? <Loader2 className="w-8 h-8 animate-spin" />
                    : <Plus className="w-8 h-8" />}
                  <span className="text-[11px] px-6 text-center leading-relaxed">{t('highlights.startBlankHint')}</span>
                </span>
                <span className="block text-center pt-2.5 text-sm font-medium text-bark group-hover:text-kaydo">
                  {t('highlights.startBlank')}
                </span>
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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
                {highlights.map((highlight) => {
                  const shots = highlight.doc?.shots || []
                  return (
                    <div key={highlight.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => navigate(`/highlight/${highlight.id}`)}
                        className="w-full text-left transition-transform hover:-translate-y-1 active:scale-[0.98]"
                      >
                        <ReelPoster shot={shots[0]} aspect={highlight.doc?.aspect} />
                        <span className="block pt-2.5 text-sm font-medium text-bark text-center truncate">
                          {highlight.title || t('reel.defaultTitle')}
                        </span>
                        <span className="block text-center text-[11px] text-bark-muted">
                          {t('reel.shots', { count: shots.length })}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteHighlight(highlight.id)}
                        aria-label={t('editor.delete')}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-warm-white/95 text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center justify-center shadow-md"
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

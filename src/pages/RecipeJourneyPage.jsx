import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, GitFork, GitBranch, ArrowLeftRight, ChefHat, Eye } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useRecipeLineage } from '../hooks/useRecipes'
import RecipeEvolutionTree from '../components/recipes/RecipeEvolutionTree'
import RecipeComparisonModal from '../components/recipes/RecipeComparisonModal'
import Sidebar from '../components/layout/Sidebar'
import MobileHeader from '../components/layout/MobileHeader'
import EncryptedImage from '../components/media/EncryptedImage'

const CHANGE_TYPE_STYLES = {
  REMOVED: 'bg-red-100 text-red-700',
  ADDED: 'bg-green-100 text-green-700',
  MODIFIED: 'bg-amber-100 text-amber-700',
}

export default function RecipeJourneyPage() {
  const { t } = useTranslation('recipes')
  const { id } = useParams()
  const { isAdmin, familyId, encryptionKey } = useAuth()
  const navigate = useNavigate()
  const { versions, loading, setViewerVisible } = useRecipeLineage(id, familyId, encryptionKey, { viewer: !isAdmin })
  const [showComparison, setShowComparison] = useState(false)
  // Set while a change of the sharing flag is being saved: the box shows the
  // new state at once, and the stored one again if the save fails.
  const [pendingShare, setPendingShare] = useState(null)
  const [shareError, setShareError] = useState(false)

  const root = versions[0]
  // Every version carries the recipe's flag, so any of them can answer.
  const shared = pendingShare ?? root?.viewerVisible === true

  const toggleShare = async () => {
    const next = !shared
    setPendingShare(next)
    setShareError(false)
    try {
      await setViewerVisible(next)
    } catch (err) {
      if (import.meta.env.DEV) console.error('setViewerVisible error:', err)
      setShareError(true)
    } finally {
      setPendingShare(null)
    }
  }

  const latest = versions[versions.length - 1]
  const latestChanges = latest?.changes || []
  const hasMultipleVersions = versions.length > 1

  return (
    <div className="min-h-screen bg-cream flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-20 lg:pb-0">
        <MobileHeader />

        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <div className="w-6 h-6 border-2 border-kaydo border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !root ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center p-8">
            <ChefHat className="w-12 h-12 text-bark-muted" />
            <p className="font-semibold text-bark">{t('journey.notFound')}</p>
            <button
              onClick={() => navigate('/recipes')}
              className="text-sm text-kaydo font-semibold"
            >
              {t('journey.backToRecipes')}
            </button>
          </div>
        ) : (
          <>
            {/* Hero */}
            <div className="relative w-full h-56 md:h-72 overflow-hidden shrink-0">
              {root.image ? (
                <EncryptedImage
                  src={root.image}
                  alt={root.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-amber-900 to-stone-800" />
              )}
              <div className="absolute inset-0 bg-black/50" />

              {/* Back */}
              <button
                onClick={() => navigate('/recipes')}
                className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              {/* Hero content */}
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-amber-300 bg-amber-900/60 rounded-full px-2.5 py-1 mb-2">
                  {t('journey.origin')}
                </span>
                <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">{root.title}</h1>
                <p className="text-white/70 text-sm mt-1">
                  {t('journey.byline', { year: root.year, author: root.author })}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 p-4 md:p-8 max-w-3xl xl:max-w-5xl mx-auto w-full space-y-8">

              {/* Sharing with the viewers — the recipe and all of its versions */}
              {isAdmin && (
                <div className="bg-warm-white rounded-2xl p-4 shadow-sm">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shared}
                      disabled={pendingShare !== null}
                      onChange={toggleShare}
                      className="mt-0.5 w-4 h-4 rounded accent-kaydo"
                    />
                    <span>
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-bark">
                        <Eye className="w-4 h-4 text-kaydo" />
                        {t('journey.share.label')}
                      </span>
                      <span className="block text-xs text-bark-muted mt-0.5">{t('journey.share.hint')}</span>
                    </span>
                  </label>
                  {shareError && (
                    <p className="text-xs text-red-600 mt-2" role="alert">{t('journey.share.error')}</p>
                  )}
                </div>
              )}

              {/* Compare button */}
              {hasMultipleVersions && (
                <button
                  onClick={() => setShowComparison(true)}
                  className="w-full flex items-center justify-center gap-2 bg-warm-white border border-cream-dark rounded-2xl py-3 text-sm font-semibold text-bark hover:bg-cream-dark transition-colors shadow-sm"
                >
                  <ArrowLeftRight className="w-4 h-4 text-kaydo" />
                  {t('journey.compareVersions')}
                </button>
              )}

              {/* Evolution Tree */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <GitBranch className="w-5 h-5 text-kaydo" />
                  <h2 className="text-lg font-bold text-bark">{t('journey.evolutionTree')}</h2>
                </div>
                <RecipeEvolutionTree
                  versions={versions}
                  onVersionClick={(v) => navigate(`/recipes/${id}/version/${v.id}`)}
                />
              </div>

              {/* Change Log (from latest version) */}
              {latestChanges.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold text-bark mb-4">{t('journey.changeLog')}</h2>
                  <div className="space-y-3">
                    {latestChanges.map((change, i) => {
                      const styleClass = CHANGE_TYPE_STYLES[change.type] || 'bg-stone-100 text-stone-600'
                      const icon = change.type === 'REMOVED' ? '−' : change.type === 'ADDED' ? '+' : '↻'
                      return (
                        <div key={i} className="flex items-start gap-3 bg-warm-white rounded-2xl p-4 shadow-sm">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${styleClass}`}
                          >
                            {icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-[10px] font-bold uppercase tracking-wide ${styleClass.split(' ')[1]}`}>
                                {t('compare.diff.' + change.type.toLowerCase(), change.type)}
                              </span>
                              <span className="text-sm font-semibold text-bark">{change.ingredient}</span>
                            </div>
                            {change.description && (
                              <p className="text-sm text-bark-muted">{change.description}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Fork Reason quote */}
              {latest?.forkReason && hasMultipleVersions && (
                <div className="bg-warm-white rounded-2xl p-5 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-kaydo mb-3">
                    {t('journey.forkReasonLabel')}
                  </p>
                  <blockquote className="text-bark italic leading-relaxed">
                    "{latest.forkReason}"
                  </blockquote>
                  <p className="text-sm text-bark-muted mt-3">
                    {t('journey.forkAttribution', { author: latest.author, year: latest.year })}
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-bark-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-kaydo inline-block" />
                    {t('journey.legacy', { count: versions.length })}
                  </div>
                </div>
              )}

              {/* Fork CTA — a viewer reads, and forking is writing */}
              {isAdmin && (
                <div className="pb-4">
                  <button
                    onClick={() => navigate(`/recipes/${latest.id}/fork`)}
                    className="btn-kaydo w-full flex items-center justify-center gap-2 py-3 text-sm font-bold"
                  >
                    <GitFork className="w-4 h-4" />
                    {t('journey.forkRecipe')}
                  </button>
                </div>
              )}

            </div>
          </>
        )}
      </div>

      {showComparison && versions.length >= 2 && (
        <RecipeComparisonModal
          versionA={versions[0]}
          versionB={versions[versions.length - 1]}
          allVersions={versions}
          onClose={() => setShowComparison(false)}
        />
      )}
    </div>
  )
}

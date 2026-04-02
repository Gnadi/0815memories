import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, GitFork, GitBranch, ArrowLeftRight, ChefHat } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useRecipeLineage } from '../hooks/useRecipes'
import RecipeEvolutionTree from '../components/recipes/RecipeEvolutionTree'
import RecipeComparisonModal from '../components/recipes/RecipeComparisonModal'
import Sidebar from '../components/layout/Sidebar'
import MobileHeader from '../components/layout/MobileHeader'

const CHANGE_TYPE_STYLES = {
  REMOVED: 'bg-red-100 text-red-700',
  ADDED: 'bg-green-100 text-green-700',
  MODIFIED: 'bg-amber-100 text-amber-700',
}

export default function RecipeJourneyPage() {
  const { id } = useParams()
  const { isAdmin, familyId } = useAuth()
  const navigate = useNavigate()
  const { versions, loading } = useRecipeLineage(id, familyId)
  const [showComparison, setShowComparison] = useState(false)

  useEffect(() => {
    if (!isAdmin) navigate('/home')
  }, [isAdmin, navigate])

  if (!isAdmin) return null

  const root = versions[0]
  const latest = versions[versions.length - 1]
  const latestChanges = latest?.changes || []
  const hasMultipleVersions = versions.length > 1

  return (
    <div className="min-h-screen bg-cream flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen pb-20 lg:pb-0">
        <MobileHeader />

        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <div className="w-6 h-6 border-2 border-hearth border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !root ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center p-8">
            <ChefHat className="w-12 h-12 text-bark-muted" />
            <p className="font-semibold text-bark">Recipe not found.</p>
            <button
              onClick={() => navigate('/recipes')}
              className="text-sm text-hearth font-semibold"
            >
              ← Back to Recipes
            </button>
          </div>
        ) : (
          <>
            {/* Hero */}
            <div className="relative w-full h-56 md:h-72 overflow-hidden shrink-0">
              {root.image ? (
                <img
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
                  The Origin
                </span>
                <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">{root.title}</h1>
                <p className="text-white/70 text-sm mt-1">
                  {root.year} · by {root.author}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 p-4 md:p-8 max-w-3xl mx-auto w-full space-y-8">

              {/* Compare button */}
              {hasMultipleVersions && (
                <button
                  onClick={() => setShowComparison(true)}
                  className="w-full flex items-center justify-center gap-2 bg-warm-white border border-cream-dark rounded-2xl py-3 text-sm font-semibold text-bark hover:bg-cream-dark transition-colors shadow-sm"
                >
                  <ArrowLeftRight className="w-4 h-4 text-hearth" />
                  Compare Versions
                </button>
              )}

              {/* Evolution Tree */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <GitBranch className="w-5 h-5 text-hearth" />
                  <h2 className="text-lg font-bold text-bark">The Evolution Tree</h2>
                </div>
                <RecipeEvolutionTree
                  versions={versions}
                  onVersionClick={(v) => navigate(`/recipes/${id}/version/${v.id}`)}
                />
              </div>

              {/* Change Log (from latest version) */}
              {latestChanges.length > 0 && (
                <div>
                  <h2 className="text-lg font-bold text-bark mb-4">Change Log</h2>
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
                                {change.type}
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
                  <p className="text-xs font-bold uppercase tracking-wider text-hearth mb-3">
                    Reason for the Fork
                  </p>
                  <blockquote className="text-bark italic leading-relaxed">
                    "{latest.forkReason}"
                  </blockquote>
                  <p className="text-sm text-bark-muted mt-3">
                    — {latest.author}, {latest.year}
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-bark-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-hearth inline-block" />
                    A Living Family Legacy · {versions.length} Generation{versions.length !== 1 ? 's' : ''} of Shared History
                  </div>
                </div>
              )}

              {/* Fork CTA */}
              <div className="pb-4">
                <button
                  onClick={() => navigate(`/recipes/${latest.id}/fork`)}
                  className="btn-hearth w-full flex items-center justify-center gap-2 py-3 text-sm font-bold"
                >
                  <GitFork className="w-4 h-4" />
                  Fork This Recipe
                </button>
              </div>

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

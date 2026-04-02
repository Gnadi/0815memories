import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChefHat, GitFork } from 'lucide-react'
import { getDoc, doc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/layout/Sidebar'
import MobileHeader from '../components/layout/MobileHeader'

const STATUS_STYLES = {
  removed: 'text-bark-muted line-through',
  modified: 'text-bark',
  active: 'text-bark',
}
const STATUS_TAG = {
  removed: 'bg-red-100 text-red-600',
  modified: 'bg-amber-100 text-amber-700',
}

export default function RecipeVersionDetailPage() {
  const { rootId, versionId } = useParams()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  const [recipe, setRecipe] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!isAdmin) navigate('/home')
  }, [isAdmin, navigate])

  useEffect(() => {
    if (!versionId) return
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'recipes', versionId))
        if (snap.exists()) {
          setRecipe({ id: snap.id, ...snap.data() })
        } else {
          setLoadError('Recipe version not found.')
        }
      } catch {
        setLoadError('Failed to load this version. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [versionId])

  if (!isAdmin) return null

  const isOriginal = recipe && !recipe.parentId

  return (
    <div className="min-h-screen bg-cream flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen pb-20 lg:pb-0">
        <MobileHeader />

        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <div className="w-6 h-6 border-2 border-hearth border-t-transparent rounded-full animate-spin" />
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
            <p className="font-semibold text-bark">{loadError}</p>
            <button
              onClick={() => navigate(`/recipes/${rootId}`)}
              className="text-sm text-hearth font-semibold"
            >
              ← Back to Journey
            </button>
          </div>
        ) : (
          <div className="flex-1 max-w-2xl mx-auto w-full">

            {/* Hero */}
            <div className="relative w-full h-48 md:h-60 overflow-hidden shrink-0">
              {recipe.image ? (
                <img
                  src={recipe.image}
                  alt={recipe.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-amber-900 to-stone-800 flex items-center justify-center">
                  <ChefHat className="w-14 h-14 text-white/20" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40" />

              {/* Back */}
              <button
                onClick={() => navigate(`/recipes/${rootId}`)}
                className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              {/* Title overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold bg-hearth/80 text-white rounded-full px-2.5 py-0.5">
                    {recipe.year}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${isOriginal ? 'bg-stone-200/80 text-stone-700' : 'bg-amber-400/80 text-amber-900'}`}>
                    {isOriginal ? 'Original' : 'Fork'}
                  </span>
                </div>
                <h1 className="text-xl md:text-2xl font-bold text-white leading-tight">{recipe.title}</h1>
                <p className="text-white/70 text-sm mt-0.5">by {recipe.author}</p>
              </div>
            </div>

            {/* Body */}
            <div className="p-4 md:p-6 space-y-5">

              {/* Description */}
              {recipe.description && (
                <p className="text-bark-muted text-sm leading-relaxed">{recipe.description}</p>
              )}

              {/* Ingredients */}
              {recipe.ingredients && recipe.ingredients.length > 0 && (
                <div className="bg-warm-white rounded-2xl p-4 shadow-sm">
                  <h2 className="text-sm font-bold text-bark mb-3 flex items-center gap-1.5">
                    <span>🍴</span> Ingredients
                  </h2>
                  <div className="space-y-2">
                    {recipe.ingredients.map((ing, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-cream-dark last:border-0">
                        <span className={`text-sm ${STATUS_STYLES[ing.status] || STATUS_STYLES.active}`}>
                          {ing.name}
                        </span>
                        {STATUS_TAG[ing.status] && (
                          <span className={`text-[10px] font-bold uppercase rounded-md px-1.5 py-0.5 ml-2 shrink-0 ${STATUS_TAG[ing.status]}`}>
                            {ing.status}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Instructions */}
              {recipe.instructions && (
                <div className="bg-warm-white rounded-2xl p-4 shadow-sm">
                  <h2 className="text-sm font-bold text-bark mb-3">Instructions</h2>
                  <p className="text-sm text-bark leading-relaxed whitespace-pre-wrap">{recipe.instructions}</p>
                </div>
              )}

              {/* Chef's Secret Tip */}
              {recipe.chefNote && (
                <div className="bg-warm-white rounded-2xl p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-hearth mb-2">Chef's Secret Tip</p>
                  <p className="text-sm text-bark italic leading-relaxed">"{recipe.chefNote}"</p>
                </div>
              )}

              {/* Fork Reason */}
              {recipe.forkReason && (
                <div className="bg-warm-white rounded-2xl p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-hearth mb-2">Reason for the Fork</p>
                  <blockquote className="text-sm text-bark italic leading-relaxed">"{recipe.forkReason}"</blockquote>
                  <p className="text-xs text-bark-muted mt-2">— {recipe.author}, {recipe.year}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2 pb-6">
                <button
                  onClick={() => navigate(`/recipes/${versionId}/fork`)}
                  className="btn-hearth flex items-center gap-2 px-5 py-2.5 text-sm font-bold"
                >
                  <GitFork className="w-4 h-4" />
                  Fork This Version
                </button>
                <button
                  onClick={() => navigate(`/recipes/${rootId}`)}
                  className="text-sm text-bark-muted hover:text-bark transition-colors"
                >
                  ← Back to Journey
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  )
}

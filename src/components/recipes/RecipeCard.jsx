import { GitFork, ChefHat, MoreVertical, Trash2 } from 'lucide-react'
import { useState } from 'react'

export default function RecipeCard({ recipe, onClick, onDelete }) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div
      className="bg-warm-white rounded-2xl shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      {/* Hero image */}
      {recipe.image ? (
        <div className="h-40 w-full overflow-hidden">
          <img
            src={recipe.image}
            alt={recipe.title}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="h-40 w-full bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
          <ChefHat className="w-12 h-12 text-hearth/30" />
        </div>
      )}

      <div className="p-4">
        {/* Top row: year pill + menu */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold bg-hearth/10 text-hearth rounded-full px-2.5 py-0.5">
            {recipe.year}
          </span>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu((v) => !v)
              }}
              className="p-1 rounded-lg hover:bg-cream-dark text-bark-muted transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-8 z-10 bg-white rounded-xl shadow-lg border border-cream-dark min-w-[120px] overflow-hidden">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowMenu(false)
                    onDelete?.()
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-bark leading-tight">{recipe.title}</h3>

        {/* Author */}
        <p className="text-sm text-bark-muted mt-0.5">by {recipe.author}</p>

        {/* Description */}
        {recipe.description && (
          <p className="text-sm text-bark-muted mt-2 line-clamp-2">{recipe.description}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-cream-dark">
          <div className="flex items-center gap-1.5 text-xs text-bark-muted">
            <GitFork className="w-3.5 h-3.5" />
            <span>{recipe.forkCount ?? 0} fork{(recipe.forkCount ?? 0) !== 1 ? 's' : ''}</span>
          </div>
          <span className="text-sm font-semibold text-hearth">View Journey →</span>
        </div>
      </div>
    </div>
  )
}

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChefHat, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useRecipes } from '../hooks/useRecipes'
import RecipeCard from '../components/recipes/RecipeCard'
import Sidebar from '../components/layout/Sidebar'
import MobileHeader from '../components/layout/MobileHeader'

export default function RecipesPage() {
  const { isAdmin, familyId, encryptionKey } = useAuth()
  const navigate = useNavigate()
  const { recipes, loading, deleteRecipe } = useRecipes(familyId, encryptionKey)

  useEffect(() => {
    if (!isAdmin) navigate('/home')
  }, [isAdmin, navigate])

  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-cream flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen pb-20 lg:pb-0">
        <MobileHeader />
        <div className="flex-1 p-4 md:p-8 max-w-3xl mx-auto w-full">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-bark flex items-center justify-center">
                <ChefHat className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-bark">The Recipe Vault</h1>
            </div>
            <p className="text-bark-muted max-w-lg">
              Family recipes passed down through generations — each fork preserved with the story of
              why it changed. Your culinary legacy, version-controlled.
            </p>
            <button
              onClick={() => navigate('/recipes/new')}
              className="mt-5 flex items-center gap-2 bg-bark text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-bark/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add a Recipe
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-kaydo border-t-transparent rounded-full animate-spin" />
            </div>
          ) : recipes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-bark/10 flex items-center justify-center">
                <ChefHat className="w-8 h-8 text-bark-muted" />
              </div>
              <div>
                <p className="font-semibold text-bark">No recipes yet</p>
                <p className="text-sm text-bark-muted mt-1">
                  Add Grandma's first recipe and start building your family's culinary tree.
                </p>
              </div>
              <button
                onClick={() => navigate('/recipes/new')}
                className="flex items-center gap-2 bg-bark text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-bark/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Your First Recipe
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {recipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onClick={() => navigate(`/recipes/${recipe.id}`)}
                  onDelete={() => {
                    if (confirm('Delete this recipe and all its forks permanently? This cannot be undone.')) {
                      deleteRecipe(recipe.id)
                    }
                  }}
                />
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

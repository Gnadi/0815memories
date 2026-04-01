import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, ChefHat, Image as ImageIcon, GitFork } from 'lucide-react'
import { getDoc, doc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { CLOUDINARY_CLOUD_NAME } from '../config/cloudinary'
import { useAuth } from '../context/AuthContext'
import { useRecipes } from '../hooks/useRecipes'
import Sidebar from '../components/layout/Sidebar'
import MobileHeader from '../components/layout/MobileHeader'

const STATUS_LABELS = { active: 'Active', removed: 'Removed', modified: 'Modified' }
const STATUS_STYLES = {
  active: 'bg-green-100 text-green-700',
  removed: 'bg-red-100 text-red-700 line-through',
  modified: 'bg-amber-100 text-amber-700',
}
const CHANGE_TYPES = ['ADDED', 'REMOVED', 'MODIFIED']

export default function CreateRecipePage() {
  const { id } = useParams()
  const isFork = !!id
  const { isAdmin, familyId } = useAuth()
  const navigate = useNavigate()
  const { addRecipe } = useRecipes(familyId)

  const [parent, setParent] = useState(null)
  const [parentLoading, setParentLoading] = useState(isFork)
  const [form, setForm] = useState({
    title: '',
    year: new Date().getFullYear(),
    author: '',
    description: '',
    instructions: '',
    chefNote: '',
    forkReason: '',
  })
  const [ingredients, setIngredients] = useState([])
  const [changes, setChanges] = useState([])
  const [image, setImage] = useState(null) // { preview, url, uploading }
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!isAdmin) navigate('/home')
  }, [isAdmin, navigate])

  // Load parent recipe when forking
  useEffect(() => {
    if (!isFork || !id) return
    getDoc(doc(db, 'recipes', id)).then((snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() }
        setParent(data)
        // Pre-populate inherited ingredients (copies of parent's active/modified ones)
        setIngredients(
          (data.ingredients || []).map((ing) => ({ ...ing, id: crypto.randomUUID() }))
        )
      }
      setParentLoading(false)
    })
  }, [id, isFork])

  if (!isAdmin) return null
  if (isFork && parentLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-hearth border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const addIngredient = () => {
    setIngredients((prev) => [...prev, { id: crypto.randomUUID(), name: '', status: 'active' }])
  }

  const updateIngredient = (ingId, field, value) => {
    setIngredients((prev) =>
      prev.map((ing) => (ing.id === ingId ? { ...ing, [field]: value } : ing))
    )
  }

  const removeIngredient = (ingId) => {
    setIngredients((prev) => prev.filter((ing) => ing.id !== ingId))
  }

  const addChange = () => {
    setChanges((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type: 'REMOVED', ingredient: '', description: '' },
    ])
  }

  const updateChange = (changeId, field, value) => {
    setChanges((prev) =>
      prev.map((c) => (c.id === changeId ? { ...c, [field]: value } : c))
    )
  }

  const removeChange = (changeId) => {
    setChanges((prev) => prev.filter((c) => c.id !== changeId))
  }

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileInputRef.current) fileInputRef.current.value = ''

    const preview = URL.createObjectURL(file)
    setImage({ preview, url: '', uploading: true })

    try {
      const signRes = await fetch('/api/cloudinary-sign')
      if (!signRes.ok) throw new Error('Failed to get upload signature')
      const { timestamp, signature, folder, apiKey } = await signRes.json()

      const formData = new FormData()
      formData.append('file', file)
      formData.append('timestamp', String(timestamp))
      formData.append('signature', signature)
      formData.append('api_key', apiKey)
      formData.append('folder', folder)

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      )
      if (!response.ok) throw new Error('Upload failed')
      const data = await response.json()
      setImage({ preview, url: data.secure_url, uploading: false })
    } catch (err) {
      console.error('Image upload failed:', err)
      setImage(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { setError('Recipe title is required.'); return }
    if (!form.author.trim()) { setError('Author name is required.'); return }
    if (image?.uploading) { setError('Please wait for the image to finish uploading.'); return }
    setError('')
    setSaving(true)

    try {
      const rootId = isFork ? (parent.rootId ?? parent.id) : null
      const parentId = isFork ? parent.id : null

      const payload = {
        title: form.title.trim(),
        year: Number(form.year),
        author: form.author.trim(),
        description: form.description.trim(),
        instructions: form.instructions.trim(),
        chefNote: form.chefNote.trim(),
        forkReason: isFork ? form.forkReason.trim() : '',
        ingredients: ingredients.map(({ id: _id, ...rest }) => rest),
        changes: isFork ? changes.map(({ id: _id, ...rest }) => rest) : [],
        parentId,
        rootId,
        image: image?.url || null,
      }

      const ref = await addRecipe(payload)
      const targetRootId = rootId ?? ref.id
      navigate(`/recipes/${targetRootId}`)
    } catch (err) {
      console.error('Save error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen pb-20 lg:pb-0">
        <MobileHeader />

        {/* Sticky mobile header */}
        <div className="lg:hidden sticky top-0 z-30 bg-cream/90 backdrop-blur-sm border-b border-cream-dark px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(isFork ? `/recipes/${id}` : '/recipes')}
            className="p-2 rounded-xl hover:bg-cream-dark transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-bark" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            {isFork ? <GitFork className="w-4 h-4 text-hearth" /> : <ChefHat className="w-4 h-4 text-hearth" />}
            <span className="font-semibold text-bark text-sm">
              {isFork ? `Fork of "${parent?.title}"` : 'New Recipe'}
            </span>
          </div>
        </div>

        <div className="flex-1 p-4 md:p-8 max-w-3xl mx-auto w-full">

          {/* Desktop header */}
          <div className="hidden lg:flex items-center gap-3 mb-8">
            <button
              onClick={() => navigate(isFork ? `/recipes/${id}` : '/recipes')}
              className="p-2 rounded-xl hover:bg-cream-dark transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-bark" />
            </button>
            <div className="flex items-center gap-2">
              {isFork ? <GitFork className="w-5 h-5 text-hearth" /> : <ChefHat className="w-5 h-5 text-hearth" />}
              <h1 className="text-2xl font-bold text-bark">
                {isFork ? `Fork: "${parent?.title}"` : 'New Recipe'}
              </h1>
            </div>
          </div>

          {isFork && (
            <div className="bg-hearth/10 border border-hearth/20 rounded-2xl px-4 py-3 mb-6 text-sm text-bark">
              <span className="font-semibold text-hearth">Forking from:</span>{' '}
              {parent?.title} ({parent?.year}) by {parent?.author}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Card: Recipe Details */}
            <div className="bg-warm-white rounded-2xl p-5 shadow-sm space-y-4">
              <h2 className="font-bold text-bark text-base">Recipe Details</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-bark-muted uppercase tracking-wide block mb-1">
                    Recipe Title *
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder={isFork ? 'e.g. The Lentil & Walnut Loaf' : "e.g. Grandma's Meatloaf"}
                    className="w-full bg-cream rounded-xl px-4 py-2.5 text-sm text-bark placeholder-bark-muted border border-cream-dark focus:outline-none focus:border-hearth transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-bark-muted uppercase tracking-wide block mb-1">
                    Author / Who Made It *
                  </label>
                  <input
                    type="text"
                    value={form.author}
                    onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))}
                    placeholder="e.g. Grandma Rose"
                    className="w-full bg-cream rounded-xl px-4 py-2.5 text-sm text-bark placeholder-bark-muted border border-cream-dark focus:outline-none focus:border-hearth transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-bark-muted uppercase tracking-wide block mb-1">
                    Year
                  </label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}
                    min="1900"
                    max="2099"
                    className="w-full bg-cream rounded-xl px-4 py-2.5 text-sm text-bark placeholder-bark-muted border border-cream-dark focus:outline-none focus:border-hearth transition-colors"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-bark-muted uppercase tracking-wide block mb-1">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="A brief description of the dish and its story..."
                    rows={2}
                    className="w-full bg-cream rounded-xl px-4 py-2.5 text-sm text-bark placeholder-bark-muted border border-cream-dark focus:outline-none focus:border-hearth transition-colors resize-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-bark-muted uppercase tracking-wide block mb-1">
                    Instructions
                  </label>
                  <textarea
                    value={form.instructions}
                    onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))}
                    placeholder="Step-by-step instructions..."
                    rows={5}
                    className="w-full bg-cream rounded-xl px-4 py-2.5 text-sm text-bark placeholder-bark-muted border border-cream-dark focus:outline-none focus:border-hearth transition-colors resize-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-bark-muted uppercase tracking-wide block mb-1">
                    Chef's Secret Tip <span className="font-normal normal-case">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={form.chefNote}
                    onChange={(e) => setForm((p) => ({ ...p, chefNote: e.target.value }))}
                    placeholder="e.g. The trick is to mash only half the lentils..."
                    className="w-full bg-cream rounded-xl px-4 py-2.5 text-sm text-bark placeholder-bark-muted border border-cream-dark focus:outline-none focus:border-hearth transition-colors"
                  />
                </div>
              </div>

              {/* Image upload */}
              <div>
                <label className="text-xs font-semibold text-bark-muted uppercase tracking-wide block mb-2">
                  Recipe Photo <span className="font-normal normal-case">(optional)</span>
                </label>
                {image ? (
                  <div className="relative w-full h-40 rounded-xl overflow-hidden">
                    <img src={image.preview} alt="preview" className="w-full h-full object-cover" />
                    {image.uploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    {!image.uploading && (
                      <button
                        type="button"
                        onClick={() => setImage(null)}
                        className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-cream-dark text-sm text-bark-muted hover:border-hearth hover:text-hearth transition-colors"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Upload a photo
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </div>
            </div>

            {/* Card: Ingredients */}
            <div className="bg-warm-white rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-bark text-base">Ingredients</h2>
                {isFork && (
                  <span className="text-xs text-bark-muted">Toggle status for each ingredient</span>
                )}
              </div>

              {ingredients.length === 0 && (
                <p className="text-sm text-bark-muted">No ingredients yet — add your first one below.</p>
              )}

              <div className="space-y-2">
                {ingredients.map((ing) => (
                  <div key={ing.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={ing.name}
                      onChange={(e) => updateIngredient(ing.id, 'name', e.target.value)}
                      placeholder="e.g. 2 cups ground lentils"
                      className="flex-1 bg-cream rounded-xl px-3 py-2 text-sm text-bark placeholder-bark-muted border border-cream-dark focus:outline-none focus:border-hearth transition-colors"
                    />
                    {isFork && (
                      <div className="flex gap-1 shrink-0">
                        {['active', 'removed', 'modified'].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => updateIngredient(ing.id, 'status', s)}
                            className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                              ing.status === s
                                ? STATUS_STYLES[s]
                                : 'bg-cream text-bark-muted hover:bg-cream-dark'
                            }`}
                          >
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeIngredient(ing.id)}
                      className="p-1.5 rounded-lg text-bark-muted hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addIngredient}
                className="flex items-center gap-1.5 text-sm font-medium text-hearth hover:text-hearth-dark transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Ingredient
              </button>
            </div>

            {/* Card: Fork Story (fork mode only) */}
            {isFork && (
              <div className="bg-warm-white rounded-2xl p-5 shadow-sm space-y-4">
                <h2 className="font-bold text-bark text-base">The Fork Story</h2>

                <div>
                  <label className="text-xs font-semibold text-bark-muted uppercase tracking-wide block mb-1">
                    Why did you change this recipe?
                  </label>
                  <textarea
                    value={form.forkReason}
                    onChange={(e) => setForm((p) => ({ ...p, forkReason: e.target.value }))}
                    placeholder="e.g. Transitioning to a plant-based lifestyle was important for my health, but I couldn't let go of the Sunday dinners we shared at Grandma's..."
                    rows={3}
                    className="w-full bg-cream rounded-xl px-4 py-2.5 text-sm text-bark placeholder-bark-muted border border-cream-dark focus:outline-none focus:border-hearth transition-colors resize-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-bark-muted uppercase tracking-wide">
                      Key Changes
                    </label>
                    <button
                      type="button"
                      onClick={addChange}
                      className="flex items-center gap-1 text-xs font-medium text-hearth hover:text-hearth-dark transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Change
                    </button>
                  </div>

                  {changes.length === 0 && (
                    <p className="text-xs text-bark-muted">
                      Document the key changes to tell the story of this fork.
                    </p>
                  )}

                  <div className="space-y-2">
                    {changes.map((change) => (
                      <div key={change.id} className="flex items-start gap-2">
                        <select
                          value={change.type}
                          onChange={(e) => updateChange(change.id, 'type', e.target.value)}
                          className="bg-cream rounded-xl px-3 py-2 text-xs font-semibold text-bark border border-cream-dark focus:outline-none focus:border-hearth transition-colors shrink-0"
                        >
                          {CHANGE_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={change.ingredient}
                          onChange={(e) => updateChange(change.id, 'ingredient', e.target.value)}
                          placeholder="Ingredient name"
                          className="w-28 bg-cream rounded-xl px-3 py-2 text-sm text-bark placeholder-bark-muted border border-cream-dark focus:outline-none focus:border-hearth transition-colors"
                        />
                        <input
                          type="text"
                          value={change.description}
                          onChange={(e) => updateChange(change.id, 'description', e.target.value)}
                          placeholder="Why this change?"
                          className="flex-1 bg-cream rounded-xl px-3 py-2 text-sm text-bark placeholder-bark-muted border border-cream-dark focus:outline-none focus:border-hearth transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => removeChange(change.id)}
                          className="p-1.5 rounded-lg text-bark-muted hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 mt-0.5"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
            )}

            {/* Submit */}
            <div className="flex items-center gap-3 pb-6">
              <button
                type="submit"
                disabled={saving || image?.uploading}
                className="btn-hearth px-6 py-3 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving
                  ? 'Saving…'
                  : isFork
                  ? 'Save Fork'
                  : 'Add to Vault'}
              </button>
              <button
                type="button"
                onClick={() => navigate(isFork ? `/recipes/${id}` : '/recipes')}
                className="px-4 py-3 text-sm text-bark-muted hover:text-bark transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

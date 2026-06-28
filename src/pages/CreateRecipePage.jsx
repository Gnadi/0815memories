import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, ChefHat, Image as ImageIcon, GitFork } from 'lucide-react'
import { getDoc, doc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../context/AuthContext'
import { encryptAndUpload } from '../utils/encryptedUpload'
import { useRecipes } from '../hooks/useRecipes'
import Sidebar from '../components/layout/Sidebar'
import MobileHeader from '../components/layout/MobileHeader'
import { devError } from '../utils/devLog'

const STATUS_KEYS = { active: 'active', removed: 'removed', modified: 'modified' }
const STATUS_STYLES = {
  active: 'bg-green-100 text-green-700',
  removed: 'bg-red-100 text-red-700 line-through',
  modified: 'bg-amber-100 text-amber-700',
}
const CHANGE_TYPES = ['ADDED', 'REMOVED', 'MODIFIED']

export default function CreateRecipePage() {
  const { t } = useTranslation('recipes')
  const { id } = useParams()
  const isFork = !!id
  const { isAdmin, familyId, encryptionKey } = useAuth()
  const navigate = useNavigate()
  const { addRecipe } = useRecipes(familyId, encryptionKey)

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
  const [forkLoadError, setForkLoadError] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!isAdmin) navigate('/home')
  }, [isAdmin, navigate])

  // Load parent recipe when forking
  useEffect(() => {
    if (!isFork || !id) return
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'recipes', id))
        if (snap.exists()) {
          let data = { id: snap.id, ...snap.data() }
          if (data.familyId !== familyId) { setForkLoadError(t('form.forkLoadError')); setParentLoading(false); return }
          if (encryptionKey) {
            const { decryptFields, decryptJSON } = await import('../utils/encryption')
            data = await decryptFields(encryptionKey, data, ['title', 'description', 'instructions', 'chefNote', 'forkReason', 'author'])
            if (typeof data.ingredients === 'string') data.ingredients = await decryptJSON(encryptionKey, data.ingredients)
          }
          setParent(data)
          setIngredients(
            (data.ingredients || []).map((ing) => ({ ...ing, id: crypto.randomUUID() }))
          )
        } else {
          setForkLoadError(t('form.forkOriginalNotFound'))
        }
      } catch {
        setForkLoadError(t('form.forkLoadFailed'))
      } finally {
        setParentLoading(false)
      }
    }
    load()
  }, [id, isFork, t])

  if (!isAdmin) return null
  if (isFork && parentLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-kaydo border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (forkLoadError) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-bark font-semibold">{forkLoadError}</p>
        <button onClick={() => navigate('/recipes')} className="text-sm text-kaydo font-semibold">
          {t('journey.backToRecipes')}
        </button>
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
      const { url } = await encryptAndUpload(file, encryptionKey)
      setImage({ preview, url, uploading: false })
    } catch (err) {
      devError('Image upload failed:', err)
      setImage(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { setError(t('form.errors.titleRequired')); return }
    if (!form.author.trim()) { setError(t('form.errors.authorRequired')); return }
    if (image?.uploading) { setError(t('form.errors.imageUploading')); return }
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
      devError('Save error:', err)
      setError(t('form.errors.generic'))
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
            {isFork ? <GitFork className="w-4 h-4 text-kaydo" /> : <ChefHat className="w-4 h-4 text-kaydo" />}
            <span className="font-semibold text-bark text-sm">
              {isFork ? t('form.forkOf', { title: parent?.title }) : t('form.newRecipe')}
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
              {isFork ? <GitFork className="w-5 h-5 text-kaydo" /> : <ChefHat className="w-5 h-5 text-kaydo" />}
              <h1 className="text-2xl font-bold text-bark">
                {isFork ? t('form.forkTitle', { title: parent?.title }) : t('form.newRecipe')}
              </h1>
            </div>
          </div>

          {isFork && (
            <div className="bg-kaydo/10 border border-kaydo/20 rounded-2xl px-4 py-3 mb-6 text-sm text-bark">
              <span className="font-semibold text-kaydo">{t('form.forkingFrom')}</span>{' '}
              {t('form.forkingFromValue', { title: parent?.title, year: parent?.year, author: parent?.author })}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Card: Recipe Details */}
            <div className="bg-warm-white rounded-2xl p-5 shadow-sm space-y-4">
              <h2 className="font-bold text-bark text-base">{t('form.detailsHeading')}</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-bark-muted uppercase tracking-wide block mb-1">
                    {t('form.titleLabel')}
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder={isFork ? t('form.titlePlaceholderFork') : t('form.titlePlaceholderNew')}
                    className="w-full bg-cream rounded-xl px-4 py-2.5 text-sm text-bark placeholder-bark-muted border border-cream-dark focus:outline-none focus:border-kaydo transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-bark-muted uppercase tracking-wide block mb-1">
                    {t('form.authorLabel')}
                  </label>
                  <input
                    type="text"
                    value={form.author}
                    onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))}
                    placeholder={t('form.authorPlaceholder')}
                    className="w-full bg-cream rounded-xl px-4 py-2.5 text-sm text-bark placeholder-bark-muted border border-cream-dark focus:outline-none focus:border-kaydo transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-bark-muted uppercase tracking-wide block mb-1">
                    {t('form.yearLabel')}
                  </label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}
                    min="1900"
                    max="2099"
                    className="w-full bg-cream rounded-xl px-4 py-2.5 text-sm text-bark placeholder-bark-muted border border-cream-dark focus:outline-none focus:border-kaydo transition-colors"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-bark-muted uppercase tracking-wide block mb-1">
                    {t('form.descriptionLabel')}
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder={t('form.descriptionPlaceholder')}
                    rows={2}
                    className="w-full bg-cream rounded-xl px-4 py-2.5 text-sm text-bark placeholder-bark-muted border border-cream-dark focus:outline-none focus:border-kaydo transition-colors resize-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-bark-muted uppercase tracking-wide block mb-1">
                    {t('form.instructionsLabel')}
                  </label>
                  <textarea
                    value={form.instructions}
                    onChange={(e) => setForm((p) => ({ ...p, instructions: e.target.value }))}
                    placeholder={t('form.instructionsPlaceholder')}
                    rows={5}
                    className="w-full bg-cream rounded-xl px-4 py-2.5 text-sm text-bark placeholder-bark-muted border border-cream-dark focus:outline-none focus:border-kaydo transition-colors resize-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-bark-muted uppercase tracking-wide block mb-1">
                    {t('form.chefTipLabel')} <span className="font-normal normal-case">{t('form.optional')}</span>
                  </label>
                  <input
                    type="text"
                    value={form.chefNote}
                    onChange={(e) => setForm((p) => ({ ...p, chefNote: e.target.value }))}
                    placeholder={t('form.chefTipPlaceholder')}
                    className="w-full bg-cream rounded-xl px-4 py-2.5 text-sm text-bark placeholder-bark-muted border border-cream-dark focus:outline-none focus:border-kaydo transition-colors"
                  />
                </div>
              </div>

              {/* Image upload */}
              <div>
                <label className="text-xs font-semibold text-bark-muted uppercase tracking-wide block mb-2">
                  {t('form.photoLabel')} <span className="font-normal normal-case">{t('form.optional')}</span>
                </label>
                {image ? (
                  <div className="relative w-full h-40 rounded-xl overflow-hidden">
                    <img src={image.preview} alt={t('form.photoPreviewAlt')} className="w-full h-full object-cover" />
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
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-cream-dark text-sm text-bark-muted hover:border-kaydo hover:text-kaydo transition-colors"
                  >
                    <ImageIcon className="w-4 h-4" />
                    {t('form.uploadPhoto')}
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
                <h2 className="font-bold text-bark text-base">{t('form.ingredientsHeading')}</h2>
                {isFork && (
                  <span className="text-xs text-bark-muted">{t('form.toggleStatusHint')}</span>
                )}
              </div>

              {ingredients.length === 0 && (
                <p className="text-sm text-bark-muted">{t('form.ingredientsEmpty')}</p>
              )}

              <div className="space-y-2">
                {ingredients.map((ing) => (
                  <div key={ing.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={ing.name}
                      onChange={(e) => updateIngredient(ing.id, 'name', e.target.value)}
                      placeholder={t('form.ingredientPlaceholder')}
                      className="flex-1 bg-cream rounded-xl px-3 py-2 text-sm text-bark placeholder-bark-muted border border-cream-dark focus:outline-none focus:border-kaydo transition-colors"
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
                            {t(`form.status.${STATUS_KEYS[s]}`)}
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
                className="flex items-center gap-1.5 text-sm font-medium text-kaydo hover:text-kaydo-dark transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('form.addIngredient')}
              </button>
            </div>

            {/* Card: Fork Story (fork mode only) */}
            {isFork && (
              <div className="bg-warm-white rounded-2xl p-5 shadow-sm space-y-4">
                <h2 className="font-bold text-bark text-base">{t('form.forkStoryHeading')}</h2>

                <div>
                  <label className="text-xs font-semibold text-bark-muted uppercase tracking-wide block mb-1">
                    {t('form.forkReasonLabel')}
                  </label>
                  <textarea
                    value={form.forkReason}
                    onChange={(e) => setForm((p) => ({ ...p, forkReason: e.target.value }))}
                    placeholder={t('form.forkReasonPlaceholder')}
                    rows={3}
                    className="w-full bg-cream rounded-xl px-4 py-2.5 text-sm text-bark placeholder-bark-muted border border-cream-dark focus:outline-none focus:border-kaydo transition-colors resize-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-bark-muted uppercase tracking-wide">
                      {t('form.keyChangesLabel')}
                    </label>
                    <button
                      type="button"
                      onClick={addChange}
                      className="flex items-center gap-1 text-xs font-medium text-kaydo hover:text-kaydo-dark transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t('form.addChange')}
                    </button>
                  </div>

                  {changes.length === 0 && (
                    <p className="text-xs text-bark-muted">
                      {t('form.changesEmpty')}
                    </p>
                  )}

                  <div className="space-y-2">
                    {changes.map((change) => (
                      <div key={change.id} className="flex items-start gap-2">
                        <select
                          value={change.type}
                          onChange={(e) => updateChange(change.id, 'type', e.target.value)}
                          className="bg-cream rounded-xl px-3 py-2 text-xs font-semibold text-bark border border-cream-dark focus:outline-none focus:border-kaydo transition-colors shrink-0"
                        >
                          {CHANGE_TYPES.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={change.ingredient}
                          onChange={(e) => updateChange(change.id, 'ingredient', e.target.value)}
                          placeholder={t('form.changeIngredientPlaceholder')}
                          className="w-28 bg-cream rounded-xl px-3 py-2 text-sm text-bark placeholder-bark-muted border border-cream-dark focus:outline-none focus:border-kaydo transition-colors"
                        />
                        <input
                          type="text"
                          value={change.description}
                          onChange={(e) => updateChange(change.id, 'description', e.target.value)}
                          placeholder={t('form.changeDescriptionPlaceholder')}
                          className="flex-1 bg-cream rounded-xl px-3 py-2 text-sm text-bark placeholder-bark-muted border border-cream-dark focus:outline-none focus:border-kaydo transition-colors"
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
                className="btn-kaydo px-6 py-3 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving
                  ? t('form.saving')
                  : isFork
                  ? t('form.saveFork')
                  : t('form.addToVault')}
              </button>
              <button
                type="button"
                onClick={() => navigate(isFork ? `/recipes/${id}` : '/recipes')}
                className="px-4 py-3 text-sm text-bark-muted hover:text-bark transition-colors"
              >
                {t('common:buttons.cancel')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

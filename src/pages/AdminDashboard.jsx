import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMemories } from '../hooks/useMemories'
import { useAuth } from '../contexts/AuthContext'
import ImageUpload from '../components/ImageUpload'
import { cloudinaryUrl } from '../utils/cloudinary'

const EMPTY_FORM = {
  title: '',
  description: '',
  quote: '',
  category: '',
  location: '',
  date: new Date().toISOString().split('T')[0],
  featured: false,
}

export default function AdminDashboard() {
  const { memories, loading } = useMemories()
  const { getAdminToken, logout } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState(EMPTY_FORM)
  const [uploadedImages, setUploadedImages] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  function handleField(e) {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  function handleUpload(result) {
    setUploadedImages(prev => [...prev, result.url])
  }

  async function handleSave(e) {
    e.preventDefault()
    if (uploadedImages.length === 0) {
      setSaveError('Please upload at least one image.')
      return
    }
    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)
    try {
      const token = await getAdminToken()
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...form, images: uploadedImages }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'Failed to save')
      }
      setForm(EMPTY_FORM)
      setUploadedImages([])
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 4000)
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this memory permanently?')) return
    setDeletingId(id)
    try {
      const token = await getAdminToken()
      const res = await fetch(`/api/memory?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to delete')
    } catch (err) {
      alert(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-hearth-bg">
      {/* Header */}
      <header className="bg-white border-b border-hearth-border px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-terra rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-hearth-text">Admin Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/home" className="text-sm text-hearth-muted hover:text-terra font-medium">
            View Site
          </Link>
          <Link to="/admin/settings" className="text-sm text-hearth-muted hover:text-terra font-medium">
            Settings
          </Link>
          <button
            onClick={async () => { await logout(); navigate('/') }}
            className="text-sm text-hearth-muted hover:text-terra font-medium"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">
        {/* New Memory Form */}
        <section className="card">
          <h2 className="text-xl font-bold text-hearth-text mb-6">Post a New Memory</h2>

          <form onSubmit={handleSave} className="space-y-5">
            {/* Images */}
            <div>
              <label className="block text-sm font-semibold text-hearth-text mb-2">Photos *</label>
              <ImageUpload onUpload={handleUpload} multiple />
              {uploadedImages.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {uploadedImages.map((url, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={cloudinaryUrl(url, { width: 80, height: 80 })}
                        className="w-16 h-16 rounded-xl object-cover"
                        alt=""
                      />
                      <button
                        type="button"
                        onClick={() => setUploadedImages(prev => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-hearth-text mb-1.5">Title *</label>
                <input
                  name="title"
                  value={form.title}
                  onChange={handleField}
                  required
                  placeholder="A beautiful autumn afternoon…"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-hearth-text mb-1.5">Category</label>
                <input
                  name="category"
                  value={form.category}
                  onChange={handleField}
                  placeholder="Summer Solstice"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-hearth-text mb-1.5">Location</label>
                <input
                  name="location"
                  value={form.location}
                  onChange={handleField}
                  placeholder="Grandpa's Orchard"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-hearth-text mb-1.5">Date</label>
                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleField}
                  className="input-field"
                />
              </div>

              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="featured"
                  name="featured"
                  checked={form.featured}
                  onChange={handleField}
                  className="w-4 h-4 accent-terra"
                />
                <label htmlFor="featured" className="text-sm font-medium text-hearth-text cursor-pointer">
                  Feature this memory (hero card)
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-hearth-text mb-1.5">Quote (optional)</label>
              <input
                name="quote"
                value={form.quote}
                onChange={handleField}
                placeholder="We didn't realize we were making memories…"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-hearth-text mb-1.5">Description</label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleField}
                rows={4}
                placeholder="Tell the story of this moment…"
                className="input-field resize-none"
              />
            </div>

            {saveError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {saveError}
              </div>
            )}
            {saveSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">
                Memory posted successfully!
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Saving…
                </>
              ) : 'Post Memory'}
            </button>
          </form>
        </section>

        {/* Existing memories */}
        <section>
          <h2 className="text-xl font-bold text-hearth-text mb-4">
            All Memories ({memories.length})
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="card flex gap-4 animate-pulse">
                  <div className="w-16 h-16 rounded-xl bg-hearth-border flex-shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-4 w-1/2 bg-hearth-border rounded" />
                    <div className="h-3 w-1/3 bg-hearth-border rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : memories.length === 0 ? (
            <p className="text-hearth-muted text-sm">No memories yet. Post one above!</p>
          ) : (
            <ul className="space-y-3">
              {memories.map(m => (
                <li key={m.id} className="card flex items-center gap-4 p-3">
                  {m.images?.[0] && (
                    <img
                      src={cloudinaryUrl(m.images[0], { width: 80, height: 80 })}
                      className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                      alt=""
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-hearth-text text-sm truncate">{m.title}</p>
                    {m.date && (
                      <p className="text-xs text-hearth-muted mt-0.5">
                        {m.date?.toDate
                          ? m.date.toDate().toLocaleDateString()
                          : new Date(m.date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      to={`/memory/${m.id}`}
                      className="text-xs text-terra hover:text-terra-dark font-medium"
                    >
                      View
                    </Link>
                    <button
                      onClick={() => handleDelete(m.id)}
                      disabled={deletingId === m.id}
                      className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                    >
                      {deletingId === m.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

import { useState, useRef } from 'react'
import { X, Plus, Image as ImageIcon } from 'lucide-react'
import { CLOUDINARY_CLOUD_NAME } from '../../config/cloudinary'

export default function PostMomentModal({ moment, onClose, onSave }) {
  const getInitialImages = () => {
    if (moment?.images?.length) {
      return moment.images.map((url, i) => ({ id: i, preview: url, url, uploading: false }))
    }
    return []
  }

  const [form, setForm] = useState({
    caption: moment?.caption || '',
    category: moment?.category || '',
    location: moment?.location || '',
    label: moment?.label || '',
  })
  const [images, setImages] = useState(getInitialImages) // [{ preview, url, uploading }]
  const [imageError, setImageError] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  const isEditing = !!moment?.id

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileInputRef.current) fileInputRef.current.value = ''

    const preview = URL.createObjectURL(file)
    const tempId = Date.now()
    setImages((prev) => [...prev, { id: tempId, preview, url: '', uploading: true }])
    setImageError(false)

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

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? `Upload failed (${response.status})`)
      }

      const data = await response.json()
      setImages((prev) =>
        prev.map((img) =>
          img.id === tempId ? { ...img, url: data.secure_url, uploading: false } : img
        )
      )
    } catch (err) {
      console.error('Upload failed:', err)
      setImages((prev) => prev.filter((img) => img.id !== tempId))
    }
  }

  const handleRemoveImage = (id) => {
    setImages((prev) => prev.filter((img) => img.id !== id))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const readyImages = images.filter((img) => img.url)
    if (readyImages.length === 0) {
      setImageError(true)
      return
    }
    setSaving(true)
    try {
      const data = {
        ...form,
        images: readyImages.map((img) => img.url),
      }
      if (isEditing) {
        await onSave(moment.id, data)
      } else {
        await onSave(data)
      }
      onClose()
    } catch (err) {
      console.error('Failed to save moment:', err)
    } finally {
      setSaving(false)
    }
  }

  const hasUploading = images.some((img) => img.uploading)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-warm-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-cream-dark sticky top-0 bg-warm-white rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-bark">
            {isEditing ? 'Edit Moment' : 'Share a Moment'}
          </h2>
          <button onClick={onClose} className="text-bark-muted hover:text-bark">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Multi-image upload */}
          <div>
            <label className="block text-sm font-medium text-bark mb-2">
              Photos <span className="text-hearth">*</span>
            </label>
            <div className={`flex gap-3 flex-wrap ${imageError ? 'p-2 ring-2 ring-hearth rounded-xl' : ''}`}>
              {/* Uploaded image thumbnails */}
              {images.map((img) => (
                <div key={img.id} className="relative w-20 h-20 flex-shrink-0">
                  <img
                    src={img.preview}
                    alt=""
                    className="w-20 h-20 rounded-xl object-cover"
                  />
                  {img.uploading && (
                    <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {!img.uploading && (
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(img.id)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-bark rounded-full flex items-center justify-center text-white hover:bg-bark-light"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}

              {/* Add more button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-bark-muted flex flex-col items-center justify-center gap-1 hover:border-hearth hover:bg-cream-dark/50 transition-colors flex-shrink-0"
              >
                {images.length === 0 ? (
                  <>
                    <ImageIcon className="w-6 h-6 text-bark-muted" />
                    <span className="text-xs text-bark-muted text-center leading-tight">Add photo</span>
                  </>
                ) : (
                  <Plus className="w-6 h-6 text-bark-muted" />
                )}
              </button>
            </div>
            {imageError && (
              <p className="text-xs text-hearth mt-1">At least one photo is required.</p>
            )}
          </div>

          {/* Caption */}
          <div>
            <label className="block text-sm font-medium text-bark mb-1">
              Caption <span className="text-hearth">*</span>
            </label>
            <textarea
              name="caption"
              value={form.caption}
              onChange={handleChange}
              placeholder="What's happening right now..."
              rows={3}
              className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-hearth/30 resize-none"
              required
            />
          </div>

          {/* Category & Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-bark mb-1">Category</label>
              <input
                name="category"
                value={form.category}
                onChange={handleChange}
                placeholder="e.g., Family"
                className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-hearth/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-bark mb-1">Location</label>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="e.g., Back yard"
                className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-hearth/30"
              />
            </div>
          </div>

          {/* Circle label */}
          <div>
            <label className="block text-sm font-medium text-bark mb-1">
              Circle label <span className="text-bark-muted font-normal">(optional)</span>
            </label>
            <input
              name="label"
              value={form.label}
              onChange={handleChange}
              placeholder="e.g., Morning walk"
              className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-hearth/30"
            />
            <p className="text-xs text-bark-muted mt-1">
              Shows under the story circle. Defaults to date if blank.
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || hasUploading}
            className="btn-hearth w-full flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : hasUploading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Uploading...
              </>
            ) : isEditing ? (
              'Save Changes'
            ) : (
              'Share Moment'
            )}
          </button>
        </form>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}

import { useState, useRef } from 'react'
import { X, Plus, Image as ImageIcon } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { CLOUDINARY_CLOUD_NAME } from '../../config/cloudinary'

export default function PostMemoryModal({ memory, onClose, onSave }) {
  const getInitialImages = () => {
    if (memory?.images?.length) {
      return memory.images.map((url, i) => ({ id: i, preview: url, url, uploading: false }))
    }
    if (memory?.imageUrl) {
      return [{ id: 0, preview: memory.imageUrl, url: memory.imageUrl, uploading: false }]
    }
    return []
  }

  const [form, setForm] = useState({
    title: memory?.title || '',
    content: memory?.content || '',
    quote: memory?.quote || '',
    category: memory?.category || '',
    location: memory?.location || '',
    authorName: memory?.authorName || '',
    featured: memory?.featured || false,
    date: memory?.date
      ? new Date(memory.date.seconds ? memory.date.seconds * 1000 : memory.date)
          .toISOString()
          .split('T')[0]
      : new Date().toISOString().split('T')[0],
  })
  const [images, setImages] = useState(getInitialImages)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileInputRef.current) fileInputRef.current.value = ''

    const preview = URL.createObjectURL(file)
    const tempId = Date.now()
    setImages((prev) => [...prev, { id: tempId, preview, url: '', uploading: true }])

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
    setSaving(true)

    try {
      const readyImages = images.filter((img) => img.url)
      const imageUrls = readyImages.map((img) => img.url)

      const data = {
        ...form,
        images: imageUrls,
        imageUrl: imageUrls[0] || '',
        date: Timestamp.fromDate(new Date(form.date)),
      }

      if (memory?.id) {
        await onSave(memory.id, data)
      } else {
        await onSave(data)
      }
      onClose()
    } catch (err) {
      console.error('Failed to save:', err)
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
      <div className="relative bg-warm-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-cream-dark sticky top-0 bg-warm-white rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-bark">
            {memory ? 'Edit Memory' : 'Post a Memory'}
          </h2>
          <button
            onClick={onClose}
            className="text-bark-muted hover:text-bark"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Multi-image upload */}
          <div>
            <label className="block text-sm font-medium text-bark mb-2">Photos</label>
            <div className="flex gap-3 flex-wrap">
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

              {/* Add photo button */}
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
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-bark mb-1">Title</label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Give this memory a title..."
              className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-hearth/30"
              required
            />
          </div>

          {/* Story content */}
          <div>
            <label className="block text-sm font-medium text-bark mb-1">Story</label>
            <textarea
              name="content"
              value={form.content}
              onChange={handleChange}
              placeholder="Tell the story behind this memory..."
              rows={4}
              className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-hearth/30 resize-none"
            />
          </div>

          {/* Quote */}
          <div>
            <label className="block text-sm font-medium text-bark mb-1">
              Quote <span className="text-bark-muted font-normal">(optional)</span>
            </label>
            <input
              name="quote"
              value={form.quote}
              onChange={handleChange}
              placeholder="A memorable quote from that day..."
              className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-hearth/30"
            />
          </div>

          {/* Two columns: Category & Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-bark mb-1">Category</label>
              <input
                name="category"
                value={form.category}
                onChange={handleChange}
                placeholder="e.g., Summer Trip"
                className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-hearth/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-bark mb-1">Location</label>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="e.g., Grandpa's Orchard"
                className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-hearth/30"
              />
            </div>
          </div>

          {/* Two columns: Date & Author */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-bark mb-1">Date</label>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark outline-none focus:ring-2 focus:ring-hearth/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-bark mb-1">Shared by</label>
              <input
                name="authorName"
                value={form.authorName}
                onChange={handleChange}
                placeholder="Your name"
                className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-hearth/30"
              />
            </div>
          </div>

          {/* Featured toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="featured"
              checked={form.featured}
              onChange={handleChange}
              className="w-4 h-4 rounded accent-hearth"
            />
            <span className="text-sm text-bark">Feature this memory on the homepage</span>
          </label>

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
            ) : (
              memory ? 'Save Changes' : 'Share Memory'
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

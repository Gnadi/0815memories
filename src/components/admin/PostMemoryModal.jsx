import { useState } from 'react'
import { X } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import UploadWidget from './UploadWidget'

export default function PostMemoryModal({ memory, onClose, onSave }) {
  const [form, setForm] = useState({
    title: memory?.title || '',
    content: memory?.content || '',
    quote: memory?.quote || '',
    category: memory?.category || '',
    location: memory?.location || '',
    authorName: memory?.authorName || '',
    imageUrl: memory?.imageUrl || '',
    featured: memory?.featured || false,
    date: memory?.date
      ? new Date(memory.date.seconds ? memory.date.seconds * 1000 : memory.date)
          .toISOString()
          .split('T')[0]
      : new Date().toISOString().split('T')[0],
  })
  const [saving, setSaving] = useState(false)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      const data = {
        ...form,
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
          {/* Image upload */}
          <UploadWidget
            currentUrl={form.imageUrl}
            onUpload={(url) => setForm((prev) => ({ ...prev, imageUrl: url }))}
          />

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
            disabled={saving}
            className="btn-hearth w-full flex items-center justify-center gap-2"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              memory ? 'Save Changes' : 'Share Memory'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

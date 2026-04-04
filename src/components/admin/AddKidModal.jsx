import { useState, useRef } from 'react'
import { X, User } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext'
import { encryptAndUpload } from '../../utils/encryptedUpload'

export default function AddKidModal({ kid, onClose, onSave }) {
  const { encryptionKey } = useAuth()
  const [form, setForm] = useState({
    name: kid?.name || '',
    birthdate: kid?.birthdate
      ? new Date(kid.birthdate.seconds ? kid.birthdate.seconds * 1000 : kid.birthdate)
          .toISOString()
          .split('T')[0]
      : '',
  })
  const [photo, setPhoto] = useState(
    kid?.profilePhoto ? { preview: kid.profilePhoto, url: kid.profilePhoto, uploading: false } : null
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileInputRef.current) fileInputRef.current.value = ''

    const preview = URL.createObjectURL(file)
    setPhoto({ preview, url: '', uploading: true })

    try {
      const { url, publicId } = await encryptAndUpload(file, encryptionKey)
      setPhoto({ preview, url, publicId, uploading: false })
    } catch (err) {
      console.error('Upload failed:', err)
      setPhoto(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.birthdate) return
    setSaving(true)
    try {
      const data = {
        name: form.name.trim(),
        birthdate: Timestamp.fromDate(new Date(form.birthdate)),
        profilePhoto: photo?.url || '',
        profilePhotoPublicId: photo?.publicId || '',
      }
      if (kid?.id) {
        await onSave(kid.id, data)
      } else {
        await onSave(data)
      }
      onClose()
    } catch (err) {
      console.error('Failed to save kid:', err)
      setError(err.message || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-warm-white rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-cream-dark">
          <h2 className="text-lg font-bold text-bark">{kid ? 'Edit Child' : 'Add a Child'}</h2>
          <button onClick={onClose} className="text-bark-muted hover:text-bark">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Profile photo */}
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 rounded-full overflow-hidden bg-cream-dark border-2 border-dashed border-cream-darker flex items-center justify-center relative"
            >
              {photo ? (
                <>
                  <img src={photo.preview} alt="" className="w-full h-full object-cover" />
                  {photo.uploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </>
              ) : (
                <User className="w-10 h-10 text-bark-muted" />
              )}
            </button>
            <span className="text-xs text-bark-muted">Tap to add photo</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-bark mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Leo"
              className="w-full px-3 py-2 border border-cream-dark rounded-xl text-sm bg-cream focus:outline-none focus:ring-2 focus:ring-hearth/30"
              required
            />
          </div>

          {/* Birthdate */}
          <div>
            <label className="block text-sm font-medium text-bark mb-1">Birthday</label>
            <input
              type="date"
              value={form.birthdate}
              onChange={(e) => setForm((p) => ({ ...p, birthdate: e.target.value }))}
              className="w-full px-3 py-2 border border-cream-dark rounded-xl text-sm bg-cream focus:outline-none focus:ring-2 focus:ring-hearth/30"
              required
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={saving || photo?.uploading}
            className="btn-hearth w-full text-sm disabled:opacity-50"
          >
            {saving ? 'Saving...' : kid ? 'Save Changes' : 'Add Child'}
          </button>
        </form>
      </div>
    </div>
  )
}

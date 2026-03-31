import { useState, useRef } from 'react'
import { X, Save, Image as ImageIcon, Mic, Video } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { CLOUDINARY_CLOUD_NAME } from '../../config/cloudinary'
import VoiceMemoRecorder from './VoiceMemoRecorder'

const EMOTIONS = [
  { key: 'joy',         emoji: '😄', label: 'Joy',         bg: 'bg-yellow-100', text: 'text-yellow-800' },
  { key: 'love',        emoji: '❤️',  label: 'Love',        bg: 'bg-red-100',    text: 'text-red-800' },
  { key: 'pride',       emoji: '⭐',  label: 'Pride',       bg: 'bg-amber-100',  text: 'text-amber-800' },
  { key: 'gratitude',   emoji: '🙏',  label: 'Gratitude',   bg: 'bg-green-100',  text: 'text-green-800' },
  { key: 'wonder',      emoji: '✨',  label: 'Wonder',      bg: 'bg-purple-100', text: 'text-purple-800' },
  { key: 'nostalgia',   emoji: '🌅',  label: 'Nostalgia',   bg: 'bg-orange-100', text: 'text-orange-800' },
  { key: 'hope',        emoji: '🌱',  label: 'Hope',        bg: 'bg-emerald-100',text: 'text-emerald-800' },
  { key: 'bittersweet', emoji: '🌧️', label: 'Bittersweet', bg: 'bg-blue-100',   text: 'text-blue-800' },
]

export { EMOTIONS }

export default function JournalEntryModal({ entry, childId, childName, onClose, onSave }) {
  const getInitialImages = () => {
    if (entry?.photos?.length) {
      return entry.photos.map((url, i) => ({ id: i, preview: url, url, uploading: false }))
    }
    return []
  }

  const getInitialVideos = () => {
    if (entry?.videos?.length) {
      return entry.videos.map((v, i) => ({
        id: i, preview: v.url, url: v.url, publicId: v.publicId, title: v.title || '', uploading: false,
      }))
    }
    return []
  }

  const [form, setForm] = useState({
    title: entry?.title || '',
    volume: entry?.volume || '',
    content: entry?.content || '',
    emotion: entry?.emotion || 'love',
    date: entry?.date
      ? new Date(entry.date.seconds ? entry.date.seconds * 1000 : entry.date)
          .toISOString()
          .split('T')[0]
      : new Date().toISOString().split('T')[0],
  })
  const [images, setImages] = useState(getInitialImages)
  const [videos, setVideos] = useState(getInitialVideos)
  const [videoError, setVideoError] = useState('')
  const [voiceMemos, setVoiceMemos] = useState(entry?.voiceMemos || [])
  const [showRecorder, setShowRecorder] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)
  const videoFileInputRef = useRef(null)

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
      if (!response.ok) throw new Error('Upload failed')
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

  const handleVideoFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (videoFileInputRef.current) videoFileInputRef.current.value = ''
    setVideoError('')

    const duration = await getVideoDuration(file)
    if (duration > 60) {
      setVideoError('Video must be 60 seconds or shorter.')
      return
    }

    const preview = URL.createObjectURL(file)
    const tempId = Date.now()
    setVideos((prev) => [...prev, { id: tempId, preview, url: '', publicId: '', title: '', uploading: true }])

    try {
      const signRes = await fetch('/api/cloudinary-sign?type=video_clip')
      if (!signRes.ok) throw new Error('Failed to get upload signature')
      const { timestamp, signature, folder, apiKey } = await signRes.json()

      const formData = new FormData()
      formData.append('file', file)
      formData.append('timestamp', String(timestamp))
      formData.append('signature', signature)
      formData.append('api_key', apiKey)
      formData.append('folder', folder)

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
        { method: 'POST', body: formData }
      )
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err?.error?.message ?? `Upload failed (${response.status})`)
      }
      const data = await response.json()
      setVideos((prev) =>
        prev.map((v) =>
          v.id === tempId ? { ...v, url: data.secure_url, publicId: data.public_id, uploading: false } : v
        )
      )
    } catch (err) {
      console.error('Video upload failed:', err)
      setVideos((prev) => prev.filter((v) => v.id !== tempId))
    }
  }

  const handleVideoTitleChange = (id, title) => {
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, title } : v)))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.content.trim()) return
    setSaving(true)
    try {
      const data = {
        ...form,
        date: Timestamp.fromDate(new Date(form.date)),
        photos: images.filter((img) => img.url).map((img) => img.url),
        videos: videos.filter((v) => v.url).map((v) => ({ url: v.url, publicId: v.publicId, title: v.title })),
        voiceMemos,
      }
      if (entry?.id) {
        await onSave(entry.id, data)
      } else {
        await onSave(data)
      }
      onClose()
    } catch (err) {
      console.error('Failed to save journal entry:', err)
      setError(err.message || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const selectedEmotion = EMOTIONS.find((e) => e.key === form.emotion)
  const hasUploading = images.some((img) => img.uploading) || videos.some((v) => v.uploading)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-warm-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-cream-dark sticky top-0 bg-warm-white rounded-t-2xl z-10">
          <div>
            <p className="text-xs font-semibold text-hearth uppercase tracking-wide">
              {entry ? 'Edit Letter' : `Letter to ${childName}`}
            </p>
            <h2 className="text-lg font-bold text-bark">
              {entry ? 'Edit Entry' : 'Write a New Letter'}
            </h2>
          </div>
          <button onClick={onClose} className="text-bark-muted hover:text-bark">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-bark mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              className="w-full px-3 py-2 border border-cream-dark rounded-xl text-sm bg-cream focus:outline-none focus:ring-2 focus:ring-hearth/30"
            />
          </div>

          {/* Volume label (optional) */}
          <div>
            <label className="block text-sm font-medium text-bark mb-1">
              Volume / Chapter <span className="font-normal text-bark-muted">(optional)</span>
            </label>
            <input
              type="text"
              value={form.volume}
              onChange={(e) => setForm((p) => ({ ...p, volume: e.target.value }))}
              placeholder="e.g. Volume 1: The First Steps"
              className="w-full px-3 py-2 border border-cream-dark rounded-xl text-sm bg-cream focus:outline-none focus:ring-2 focus:ring-hearth/30"
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-bark mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder={`Letters to ${childName}`}
              className="w-full px-3 py-2 border border-cream-dark rounded-xl text-sm bg-cream focus:outline-none focus:ring-2 focus:ring-hearth/30"
            />
          </div>

          {/* Emotion picker */}
          <div>
            <label className="block text-sm font-medium text-bark mb-2">How are you feeling?</label>
            <div className="flex flex-wrap gap-2">
              {EMOTIONS.map((em) => (
                <button
                  key={em.key}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, emotion: em.key }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${
                    form.emotion === em.key
                      ? `${em.bg} ${em.text} border-current`
                      : 'bg-cream text-bark-muted border-transparent hover:border-cream-darker'
                  }`}
                >
                  <span>{em.emoji}</span>
                  {em.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-bark mb-1">Your Letter</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              placeholder={`My dearest ${childName}, today…`}
              rows={8}
              className="w-full px-3 py-2 border border-cream-dark rounded-xl text-sm bg-cream focus:outline-none focus:ring-2 focus:ring-hearth/30 resize-none leading-relaxed"
              required
            />
          </div>

          {/* Photos */}
          <div>
            <label className="block text-sm font-medium text-bark mb-2">Photos (optional)</label>
            <div className="flex gap-3 flex-wrap">
              {images.map((img) => (
                <div key={img.id} className="relative w-20 h-20 flex-shrink-0">
                  <img src={img.preview} alt="" className="w-20 h-20 rounded-xl object-cover" />
                  {img.uploading && (
                    <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {!img.uploading && (
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((i) => i.id !== img.id))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-bark text-white rounded-full flex items-center justify-center text-xs"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 border-2 border-dashed border-cream-darker rounded-xl flex items-center justify-center text-bark-muted hover:border-hearth hover:text-hearth transition-colors"
              >
                <ImageIcon className="w-6 h-6" />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Videos */}
          <div>
            <label className="block text-sm font-medium text-bark mb-2">
              Videos <span className="font-normal text-bark-muted">(optional, max 60s each)</span>
            </label>
            {videos.length > 0 && (
              <div className="space-y-3 mb-3">
                {videos.map((v) => (
                  <div key={v.id} className="flex items-start gap-3 bg-cream rounded-xl p-3">
                    <div className="relative w-16 h-16 flex-shrink-0">
                      <video
                        src={v.preview}
                        className="w-16 h-16 rounded-lg object-cover bg-black"
                        muted
                        playsInline
                      />
                      {!v.uploading && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center">
                            <Video className="w-3 h-3 text-white" />
                          </div>
                        </div>
                      )}
                      {v.uploading && (
                        <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={v.title}
                        onChange={(e) => handleVideoTitleChange(v.id, e.target.value)}
                        placeholder="Add a title (optional)"
                        className="w-full px-3 py-1.5 bg-warm-white rounded-lg text-sm text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-hearth/30"
                        disabled={v.uploading}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setVideos((prev) => prev.filter((x) => x.id !== v.id))}
                      className="text-bark-muted hover:text-red-500 transition-colors mt-1 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => videoFileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-cream-darker text-sm text-bark-muted hover:border-hearth hover:text-hearth transition-colors"
            >
              <Video className="w-4 h-4" />
              Add video
            </button>
            {videoError && <p className="text-xs text-hearth mt-1">{videoError}</p>}
            <input
              ref={videoFileInputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleVideoFileChange}
            />
          </div>

          {/* Voice memos */}
          <div>
            <label className="block text-sm font-medium text-bark mb-2">Voice Memo (optional)</label>
            {voiceMemos.length > 0 && (
              <div className="flex flex-col gap-2 mb-2">
                {voiceMemos.map((memo, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-cream rounded-xl px-3 py-2">
                    <span className="text-sm text-bark">{memo.title || `Voice note ${idx + 1}`}</span>
                    <button
                      type="button"
                      onClick={() => setVoiceMemos((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-bark-muted hover:text-hearth"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {showRecorder ? (
              <VoiceMemoRecorder
                onMemoAdded={(memo) => { setVoiceMemos((prev) => [...prev, memo]); setShowRecorder(false) }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowRecorder(true)}
                className="flex items-center gap-2 text-sm text-bark-muted hover:text-bark border border-cream-dark rounded-xl px-3 py-2 transition-colors"
              >
                <Mic className="w-4 h-4" />
                Add Voice Memo
              </button>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* Save button */}
          <button
            type="submit"
            disabled={saving || hasUploading}
            className="btn-hearth w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : entry ? 'Save Changes' : 'Save Letter'}
          </button>
        </form>
      </div>
    </div>
  )
}

function getVideoDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(video.duration) }
    video.onerror = () => { URL.revokeObjectURL(url); resolve(0) }
    video.src = url
  })
}

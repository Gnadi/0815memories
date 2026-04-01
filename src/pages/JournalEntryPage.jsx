import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Image as ImageIcon, Mic, Video, X } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { CLOUDINARY_CLOUD_NAME } from '../config/cloudinary'
import { EMOTIONS } from '../constants/emotions'
import VoiceMemoRecorder from '../components/admin/VoiceMemoRecorder'
import { useAuth } from '../context/AuthContext'
import { useKids } from '../hooks/useKids'
import { useJournals } from '../hooks/useJournals'

const today = new Date().toISOString().split('T')[0]

export default function JournalEntryPage() {
  const { childId, entryId } = useParams()
  const { isAdmin, familyId } = useAuth()
  const navigate = useNavigate()
  const { kids } = useKids(familyId)
  const { journals, addJournal, updateJournal } = useJournals(familyId, childId)

  const kid = kids.find((k) => k.id === childId)
  const entry = entryId ? journals.find((j) => j.id === entryId) : null

  const [form, setForm] = useState({
    title: '',
    volume: '',
    content: '',
    emotion: 'love',
    date: today,
  })
  const [images, setImages] = useState([])
  const [videos, setVideos] = useState([])
  const [videoError, setVideoError] = useState('')
  const [voiceMemos, setVoiceMemos] = useState([])
  const [showRecorder, setShowRecorder] = useState(false)
  const [showEmotionPicker, setShowEmotionPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)
  const videoFileInputRef = useRef(null)

  useEffect(() => {
    if (!isAdmin) navigate('/home')
  }, [isAdmin, navigate])

  // Populate form when editing an existing entry (entry loads async from Firestore)
  useEffect(() => {
    if (entry) {
      setForm({
        title: entry.title || '',
        volume: entry.volume || '',
        content: entry.content || '',
        emotion: entry.emotion || 'love',
        date: new Date(entry.date.seconds * 1000).toISOString().split('T')[0],
      })
      setImages(
        entry.photos?.map((url, i) => ({ id: i, preview: url, url, uploading: false })) || []
      )
      setVideos(
        entry.videos?.map((v, i) => ({
          id: i, preview: v.url, url: v.url, publicId: v.publicId, title: v.title || '', uploading: false,
        })) || []
      )
      setVoiceMemos(entry.voiceMemos || [])
    }
  }, [entry?.id])

  if (!isAdmin) return null

  const selectedEmotion = EMOTIONS.find((e) => e.key === form.emotion) || EMOTIONS[1]

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
        prev.map((img) => (img.id === tempId ? { ...img, url: data.secure_url, uploading: false } : img))
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.content.trim()) return
    setError('')
    setSaving(true)
    try {
      const data = {
        ...form,
        date: Timestamp.fromDate(new Date(form.date)),
        photos: images.filter((img) => img.url).map((img) => img.url),
        videos: videos.filter((v) => v.url).map((v) => ({ url: v.url, publicId: v.publicId, title: v.title })),
        voiceMemos,
      }
      if (entry) {
        await updateJournal(entry.id, data)
      } else {
        await addJournal(data)
      }
      navigate(`/journal/${childId}`)
    } catch (err) {
      console.error('Failed to save journal entry:', err)
      setError(err.message || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const hasUploading = images.some((img) => img.uploading) || videos.some((v) => v.uploading)

  return (
    <div className="h-screen flex flex-col relative overflow-hidden">

      {/* Background */}
      <div className="absolute inset-0 -z-10">
        {kid?.profilePhoto ? (
          <img src={kid.profilePhoto} className="w-full h-full object-cover" alt="" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-rose-200 via-orange-100 to-amber-200" />
        )}
        <div className="absolute inset-0 bg-black/35" />
      </div>

      {/* Top bar */}
      <div className="px-4 pt-4 pb-1 flex items-center justify-between flex-shrink-0">
        <button
          type="button"
          onClick={() => navigate(`/journal/${childId}`)}
          className="w-9 h-9 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/30 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setShowEmotionPicker((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm ${selectedEmotion.bg} ${selectedEmotion.text}`}
        >
          {selectedEmotion.emoji} {selectedEmotion.label}
        </button>
      </div>

      {/* Emotion picker */}
      {showEmotionPicker && (
        <div className="mx-4 mb-1 flex flex-wrap gap-2 p-3 bg-white/88 backdrop-blur-md rounded-2xl flex-shrink-0 shadow-lg">
          {EMOTIONS.map((em) => (
            <button
              key={em.key}
              type="button"
              onClick={() => { setForm((p) => ({ ...p, emotion: em.key })); setShowEmotionPicker(false) }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border-2 transition-all ${
                form.emotion === em.key
                  ? `${em.bg} ${em.text} border-current`
                  : 'border-transparent text-stone-500 hover:bg-white/60'
              }`}
            >
              {em.emoji} {em.label}
            </button>
          ))}
        </div>
      )}

      {/* Title + metadata */}
      <div className="px-5 py-2 flex-shrink-0">
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          placeholder="A Message for your Future Self"
          className="w-full bg-transparent text-white text-2xl font-bold placeholder-white/40 outline-none leading-tight"
        />
        <div className="flex items-center gap-2 mt-2">
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
            className="bg-transparent text-white/70 text-sm outline-none [color-scheme:dark]"
          />
          {form.volume && (
            <>
              <span className="text-white/40">•</span>
              <span className="text-white/70 text-sm">{form.volume}</span>
            </>
          )}
        </div>
      </div>

      {/* Writing card */}
      <form
        id="journal-entry-form"
        onSubmit={handleSubmit}
        className="flex-1 bg-white/[0.92] backdrop-blur-md rounded-t-3xl mx-1 flex flex-col min-h-0 shadow-2xl overflow-hidden"
      >
        {/* Coral accent line */}
        <div className="w-10 h-1 rounded-full bg-hearth mx-5 mt-3 flex-shrink-0" />

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* Volume / Chapter */}
          <div className="px-5 pt-2">
            <input
              type="text"
              value={form.volume}
              onChange={(e) => setForm((p) => ({ ...p, volume: e.target.value }))}
              placeholder="Volume / Chapter (optional)"
              className="w-full text-xs text-stone-400 bg-transparent outline-none placeholder-stone-300"
            />
          </div>

          {/* Media strip */}
          {(images.length > 0 || videos.length > 0) && (
            <div className="px-5 pt-3 flex gap-2 overflow-x-auto pb-1">
              {images.map((img) => (
                <div key={img.id} className="relative flex-shrink-0 w-16 h-16">
                  <img src={img.preview} alt="" className="w-16 h-16 rounded-xl object-cover" />
                  {img.uploading ? (
                    <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((i) => i.id !== img.id))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-stone-800 text-white rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {videos.map((v) => (
                <div key={v.id} className="relative flex-shrink-0 w-16 h-16">
                  <video src={v.preview} className="w-16 h-16 rounded-xl object-cover bg-black" muted playsInline />
                  {v.uploading ? (
                    <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <>
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-5 h-5 rounded-full bg-black/50 flex items-center justify-center">
                          <Video className="w-3 h-3 text-white" />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setVideos((prev) => prev.filter((x) => x.id !== v.id))}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-stone-800 text-white rounded-full flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Voice memo list */}
          {voiceMemos.length > 0 && (
            <div className="px-5 pt-2 space-y-1">
              {voiceMemos.map((memo, idx) => (
                <div key={idx} className="flex items-center justify-between bg-stone-100 rounded-xl px-3 py-1.5">
                  <span className="text-xs text-stone-600">🎙 {memo.title || `Voice note ${idx + 1}`}</span>
                  <button
                    type="button"
                    onClick={() => setVoiceMemos((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-stone-400 hover:text-hearth ml-2 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Voice recorder */}
          {showRecorder && (
            <div className="px-5 pt-2">
              <VoiceMemoRecorder
                onMemoAdded={(memo) => { setVoiceMemos((p) => [...p, memo]); setShowRecorder(false) }}
              />
            </div>
          )}

          {/* Errors */}
          {(error || videoError) && (
            <p className="px-5 pt-2 text-xs text-red-500">{error || videoError}</p>
          )}

          {/* Main textarea */}
          <textarea
            value={form.content}
            onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
            placeholder={`My dearest ${kid?.name || 'child'}, today…`}
            className="w-full min-h-64 px-5 py-3 bg-transparent text-stone-700 text-base leading-relaxed resize-none outline-none placeholder-stone-300"
          />
        </div>

        {/* Sticky bottom toolbar */}
        <div className="flex-shrink-0 border-t border-stone-100 px-5 py-3 flex items-center gap-4 bg-white/60">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-stone-400 hover:text-stone-700 transition-colors"
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowRecorder((v) => !v)}
            className={`transition-colors ${showRecorder ? 'text-hearth' : 'text-stone-400 hover:text-stone-700'}`}
          >
            <Mic className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => videoFileInputRef.current?.click()}
            className="text-stone-400 hover:text-stone-700 transition-colors"
          >
            <Video className="w-5 h-5" />
          </button>
          <div className="ml-auto">
            {saving ? (
              <span className="text-xs tracking-[0.25em] uppercase font-medium text-stone-400">
                Saving…
              </span>
            ) : hasUploading ? (
              <span className="text-xs tracking-widest uppercase text-stone-400">
                Uploading…
              </span>
            ) : (
              <button
                type="submit"
                disabled={!form.content.trim()}
                className="text-xs tracking-[0.2em] uppercase font-semibold text-hearth disabled:text-stone-300 transition-colors"
              >
                {entry ? 'Update' : 'Save'}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <input ref={videoFileInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoFileChange} />
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

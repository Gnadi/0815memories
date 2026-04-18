import { useState, useRef, useEffect } from 'react'
import { X, Plus, Image as ImageIcon, Mic, Video, Camera } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext'
import { decryptFields } from '../../utils/encryption'
import { devError } from '../../utils/devLog'
import { useMediaUploader } from '../../hooks/useMediaUploader'
import EncryptedImage from '../media/EncryptedImage'
import EncryptedVideo from '../media/EncryptedVideo'
import VoiceMemoRecorder from './VoiceMemoRecorder'

const ENCRYPTED_FIELDS = ['title', 'content', 'quote', 'location', 'authorName', 'category']

function buildInitialImages(memory) {
  if (memory?.images?.length) {
    return memory.images.map((url, i) => ({ id: `init-img-${i}`, preview: url, url, uploading: false }))
  }
  if (memory?.imageUrl) {
    return [{ id: 'init-img-0', preview: memory.imageUrl, url: memory.imageUrl, uploading: false }]
  }
  return []
}

function buildInitialVideos(memory) {
  if (memory?.videos?.length) {
    return memory.videos.map((v, i) => ({
      id: `init-vid-${i}`,
      preview: v.url,
      url: v.url,
      publicId: v.publicId,
      title: v.title || '',
      uploading: false,
    }))
  }
  return []
}

export default function PostMemoryModal({ memory, onClose, onSave }) {
  const { encryptionKey } = useAuth()
  const {
    images,
    videos,
    setVideos,
    addImage,
    addVideo,
    removeImage,
    removeVideo,
    videoError,
    hasUploading,
  } = useMediaUploader(encryptionKey, {
    initialImages: buildInitialImages(memory),
    initialVideos: buildInitialVideos(memory),
  })

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

  // Ensure form fields are plaintext even if the caller passes an
  // encrypted memory (e.g. direct getDoc reads that bypass the hooks).
  useEffect(() => {
    if (!memory || !encryptionKey) return
    let cancelled = false
    decryptFields(encryptionKey, memory, ENCRYPTED_FIELDS).then((decrypted) => {
      if (cancelled) return
      setForm((prev) => ({
        ...prev,
        title: decrypted.title || '',
        content: decrypted.content || '',
        quote: decrypted.quote || '',
        category: decrypted.category || '',
        location: decrypted.location || '',
        authorName: decrypted.authorName || '',
      }))
    })
    return () => {
      cancelled = true
    }
  }, [memory, encryptionKey])
  const [voiceMemos, setVoiceMemos] = useState(memory?.voiceMemos || [])
  const [showRecorder, setShowRecorder] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const videoFileInputRef = useRef(null)
  const videoCameraInputRef = useRef(null)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleImagePick = async (e, inputRef) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (inputRef?.current) inputRef.current.value = ''
    await addImage(file)
  }

  const handleVideoPick = async (e, inputRef) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (inputRef?.current) inputRef.current.value = ''
    await addVideo(file)
  }

  const handleVideoTitleChange = (id, title) => {
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, title } : v)))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      const readyImages = images.filter((img) => img.url)
      const imageUrls = readyImages.map((img) => img.url)
      const readyVideos = videos.filter((v) => v.url)

      const data = {
        ...form,
        images: imageUrls,
        imageUrl: imageUrls[0] || '',
        date: Timestamp.fromDate(new Date(form.date)),
        voiceMemos,
        videos: readyVideos.map((v) => ({ url: v.url, publicId: v.publicId, title: v.title })),
      }

      if (memory?.id) {
        await onSave(memory.id, data)
      } else {
        await onSave(data)
      }
      onClose()
    } catch (err) {
      devError('Failed to save memory:', err)
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
          {/* Multi-image upload */}
          <div>
            <label className="block text-sm font-medium text-bark mb-2">Photos</label>
            <div className="flex gap-3 flex-wrap">
              {images.map((img) => (
                <div key={img.id} className="relative w-20 h-20 flex-shrink-0">
                  {img.preview?.startsWith('blob:') ? (
                    <img
                      src={img.preview}
                      alt=""
                      className="w-20 h-20 rounded-xl object-cover"
                    />
                  ) : (
                    <EncryptedImage
                      src={img.preview}
                      className="w-20 h-20 rounded-xl object-cover"
                    />
                  )}
                  {img.uploading && (
                    <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {!img.uploading && (
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
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
                className="w-20 h-20 rounded-xl border-2 border-dashed border-bark-muted flex flex-col items-center justify-center gap-1 hover:border-kaydo hover:bg-cream-dark/50 transition-colors flex-shrink-0"
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

              {/* Take photo button - mobile only */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-bark-muted flex flex-col items-center justify-center gap-1 hover:border-kaydo hover:bg-cream-dark/50 transition-colors flex-shrink-0 lg:hidden"
              >
                <Camera className="w-6 h-6 text-bark-muted" />
                <span className="text-xs text-bark-muted text-center leading-tight">Camera</span>
              </button>
            </div>
          </div>

          {/* Video upload */}
          <div>
            <label className="block text-sm font-medium text-bark mb-2">
              Videos <span className="text-bark-muted font-normal">(max 60s each)</span>
            </label>

            {/* Uploaded videos list */}
            {videos.length > 0 && (
              <div className="space-y-3 mb-3">
                {videos.map((v) => (
                  <div key={v.id} className="flex items-start gap-3 bg-cream-dark rounded-xl p-3">
                    <div className="relative w-16 h-16 flex-shrink-0">
                      {v.preview?.startsWith('blob:') ? (
                        <video
                          src={v.preview}
                          className="w-16 h-16 rounded-lg object-cover bg-black"
                          muted
                          playsInline
                        />
                      ) : (
                        <EncryptedVideo
                          src={v.preview}
                          className="w-16 h-16 rounded-lg object-cover bg-black"
                          controls={false}
                          muted
                          playsInline
                        />
                      )}
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
                        className="w-full px-3 py-1.5 bg-white rounded-lg text-sm text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
                        disabled={v.uploading}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeVideo(v.id)}
                      className="text-bark-muted hover:text-red-500 transition-colors mt-1 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add video / Record video buttons */}
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => videoFileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-bark-muted text-sm text-bark-muted hover:border-kaydo hover:text-kaydo transition-colors"
              >
                <Video className="w-4 h-4" />
                Add video
              </button>

              {/* Record video button - mobile only */}
              <button
                type="button"
                onClick={() => videoCameraInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-bark-muted text-sm text-bark-muted hover:border-kaydo hover:text-kaydo transition-colors lg:hidden"
              >
                <Camera className="w-4 h-4" />
                Record video
              </button>
            </div>
            {videoError && (
              <p className="text-xs text-kaydo mt-1">{videoError}</p>
            )}
          </div>

          {/* Voice Memos */}
          <div>
            <label className="block text-sm font-medium text-bark mb-2">Voice Memos</label>

            {/* Existing memos list */}
            {voiceMemos.length > 0 && (
              <div className="space-y-2 mb-3">
                {voiceMemos.map((memo, i) => (
                  <div key={memo.publicId || i} className="flex items-center gap-2 bg-cream-dark rounded-xl px-3 py-2">
                    <Mic className="w-4 h-4 text-kaydo flex-shrink-0" />
                    <span className="text-sm text-bark flex-1 truncate">
                      {memo.title || `Voice memo ${i + 1}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setVoiceMemos((prev) => prev.filter((_, j) => j !== i))}
                      className="text-bark-muted hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Recorder (toggle) */}
            {showRecorder ? (
              <VoiceMemoRecorder
                onMemoAdded={(memo) => {
                  setVoiceMemos((prev) => [...prev, memo])
                  setShowRecorder(false)
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowRecorder(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-bark-muted text-sm text-bark-muted hover:border-kaydo hover:text-kaydo transition-colors"
              >
                <Mic className="w-4 h-4" />
                Add voice memo
              </button>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-bark mb-1">Title</label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Give this memory a title..."
              className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
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
              className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30 resize-none"
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
              className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
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
                className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-bark mb-1">Location</label>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="e.g., Grandpa's Orchard"
                className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
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
                className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark outline-none focus:ring-2 focus:ring-kaydo/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-bark mb-1">Shared by</label>
              <input
                name="authorName"
                value={form.authorName}
                onChange={handleChange}
                placeholder="Your name"
                className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
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
              className="w-4 h-4 rounded accent-kaydo"
            />
            <span className="text-sm text-bark">Feature this memory on the homepage</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || hasUploading}
            className="btn-kaydo w-full flex items-center justify-center gap-2 disabled:opacity-60"
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
        onChange={(e) => handleImagePick(e, fileInputRef)}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => handleImagePick(e, cameraInputRef)}
        className="hidden"
      />
      <input
        ref={videoFileInputRef}
        type="file"
        accept="video/*"
        onChange={(e) => handleVideoPick(e, videoFileInputRef)}
        className="hidden"
      />
      <input
        ref={videoCameraInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        onChange={(e) => handleVideoPick(e, videoCameraInputRef)}
        className="hidden"
      />
    </div>
  )
}

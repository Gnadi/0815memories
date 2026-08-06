import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Plus, Image as ImageIcon, Mic, Video, Camera } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '../../context/AuthContext'
import { devError } from '../../utils/devLog'
import { useMediaUploader } from '../../hooks/useMediaUploader'
import { decryptMemoryDoc } from '../../hooks/useMemories'
import EncryptedImage from '../media/EncryptedImage'
import EncryptedVideo from '../media/EncryptedVideo'
import VoiceMemoRecorder from './VoiceMemoRecorder'
import PolaroidBorderEditor from './PolaroidBorderEditor'
import RichTextEditorLazy, { EditorSkeleton } from './RichTextEditorLazy'
import { resolvePolaroidBorder } from '../home/polaroidBorder'
import { thumbsFor, buildThumbs } from '../../utils/mediaThumbs'
import {
  EMPTY_RICH_DOC,
  isRichDoc,
  plainTextToRich,
  richToPlainText,
  stripPendingMedia,
} from '../../utils/richText'

/**
 * Ceiling on the serialized description, checked before the write.
 *
 * Encryption turns this into roughly 1.33x as much base64, and the document
 * shares a 1 MiB Firestore document with the plain-text mirror, so the limit has
 * to sit well below both that and the 700 KB cap firestore.rules enforces on the
 * ciphertext. 300k characters is around fifty thousand words — generous for a
 * memory, and it fails with a message instead of an opaque Firestore error.
 */
const MAX_RICH_DOC_CHARS = 300_000

function buildInitialImages(memory) {
  if (memory?.images?.length) {
    // Carry each image's existing thumb along so an edit that reorders or
    // removes photos rewrites `thumbs` in step instead of orphaning it.
    const thumbs = thumbsFor(memory)
    return memory.images.map((url, i) => ({
      id: `init-img-${i}`,
      preview: url,
      url,
      thumbUrl: thumbs[i] || '',
      uploading: false,
    }))
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
  const { t } = useTranslation('memory')
  const { encryptionKey, memoryCardStyle } = useAuth()
  const {
    images,
    videos,
    setVideos,
    addImage,
    addVideo,
    removeImage,
    removeVideo,
    videoError,
    imageError,
    hasUploading,
  } = useMediaUploader(encryptionKey, {
    initialImages: buildInitialImages(memory),
    initialVideos: buildInitialVideos(memory),
  })

  const [form, setForm] = useState({
    title: memory?.title || '',
    quote: memory?.quote || '',
    category: memory?.category || '',
    location: memory?.location || '',
    authorName: memory?.authorName || '',
    featured: memory?.featured || false,
    polaroidBorder: resolvePolaroidBorder(memory?.polaroidBorder),
    date: memory?.date
      ? new Date(memory.date.seconds ? memory.date.seconds * 1000 : memory.date)
          .toISOString()
          .split('T')[0]
      : new Date().toISOString().split('T')[0],
  })

  // The description document, and whether it has been decrypted yet.
  //
  // The home feed hands this modal a memory whose `contentRich` is still
  // ciphertext — the feed listener skips that field on purpose. So for an
  // existing memory the editor must not mount until the effect below has
  // decrypted it, or it would seed itself from ciphertext and then overwrite
  // the real description on save.
  const [richDoc, setRichDoc] = useState(memory ? null : { ...EMPTY_RICH_DOC })
  const [richReady, setRichReady] = useState(!memory)
  const [pendingInline, setPendingInline] = useState(0)
  const [saveError, setSaveError] = useState('')

  // Ensure form fields are plaintext even if the caller passes an
  // encrypted memory (e.g. direct getDoc reads that bypass the hooks).
  useEffect(() => {
    if (!memory) return
    let cancelled = false
    const seed = async () => {
      const decrypted = encryptionKey ? await decryptMemoryDoc(encryptionKey, memory) : memory
      if (cancelled) return
      setForm((prev) => ({
        ...prev,
        title: decrypted.title || '',
        quote: decrypted.quote || '',
        category: decrypted.category || '',
        location: decrypted.location || '',
        authorName: decrypted.authorName || '',
      }))
      // A memory written before this feature has no document — seed the editor
      // from its plain text so nothing is lost when it is saved again.
      setRichDoc(
        isRichDoc(decrypted.contentRich)
          ? decrypted.contentRich
          : plainTextToRich(decrypted.content || '')
      )
      setRichReady(true)
    }
    seed()
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
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    if (inputRef?.current) inputRef.current.value = ''
    await Promise.all(files.map((file) => addImage(file)))
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
    setSaveError('')

    // Belt and braces: media still uploading has no URL yet. The submit button
    // is already disabled while any upload is in flight, and the blob: preview
    // never enters the document (see previewStore), so this only ever drops a
    // node the user abandoned.
    const doc = stripPendingMedia(isRichDoc(richDoc) ? richDoc : { ...EMPTY_RICH_DOC })

    // Serialized here, not in the encryption layer: contentRich must reach
    // Firestore as a string so it rides the ordinary encryptFields path.
    const contentRich = JSON.stringify(doc)
    if (contentRich.length > MAX_RICH_DOC_CHARS) {
      setSaveError(t('richEditor.tooLarge'))
      return
    }

    setSaving(true)

    try {
      const readyImages = images.filter((img) => img.url)
      const imageUrls = readyImages.map((img) => img.url)
      const readyVideos = videos.filter((v) => v.url)
      const thumbs = buildThumbs(readyImages)

      const data = {
        ...form,
        contentRich,
        // Derived mirror. Every preview surface — feed cards, timeline, Web
        // Share — reads `content`, so it is rewritten from the document on each
        // save rather than edited directly.
        content: richToPlainText(doc),
        images: imageUrls,
        // Additive: written only when at least one image has a thumbnail, and
        // always positionally aligned with `images`.
        ...(thumbs ? { thumbs } : {}),
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
      setSaveError(t('postMemory.saveFailed'))
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
            {memory ? t('postMemory.titleEdit') : t('postMemory.titleNew')}
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
            <label className="block text-sm font-medium text-bark mb-2">{t('postMemory.photos')}</label>
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
                    <span className="text-xs text-bark-muted text-center leading-tight">{t('postMemory.addPhoto')}</span>
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
                <span className="text-xs text-bark-muted text-center leading-tight">{t('postMemory.camera')}</span>
              </button>
            </div>
            {imageError && (
              <p className="text-xs text-kaydo mt-1">{imageError}</p>
            )}
          </div>

          {/* Video upload */}
          <div>
            <label className="block text-sm font-medium text-bark mb-2">
              {t('postMemory.videos')} <span className="text-bark-muted font-normal">{t('postMemory.videosHint')}</span>
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
                        placeholder={t('postMemory.videoTitlePlaceholder')}
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
                {t('postMemory.addVideo')}
              </button>

              {/* Record video button - mobile only */}
              <button
                type="button"
                onClick={() => videoCameraInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-bark-muted text-sm text-bark-muted hover:border-kaydo hover:text-kaydo transition-colors lg:hidden"
              >
                <Camera className="w-4 h-4" />
                {t('postMemory.recordVideo')}
              </button>
            </div>
            {videoError && (
              <p className="text-xs text-kaydo mt-1">{videoError}</p>
            )}
          </div>

          {/* Voice Memos */}
          <div>
            <label className="block text-sm font-medium text-bark mb-2">{t('postMemory.voiceMemosLabel')}</label>

            {/* Existing memos list */}
            {voiceMemos.length > 0 && (
              <div className="space-y-2 mb-3">
                {voiceMemos.map((memo, i) => (
                  <div key={memo.publicId || i} className="flex items-center gap-2 bg-cream-dark rounded-xl px-3 py-2">
                    <Mic className="w-4 h-4 text-kaydo flex-shrink-0" />
                    <span className="text-sm text-bark flex-1 truncate">
                      {memo.title || t('postMemory.voiceMemoFallback', { index: i + 1 })}
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
                {t('postMemory.addVoiceMemo')}
              </button>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-bark mb-1">{t('postMemory.titleLabel')}</label>
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder={t('postMemory.titlePlaceholder')}
              className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
              required
            />
          </div>

          {/* Story content — text with photos, videos and voice memos inline */}
          <div>
            <label className="block text-sm font-medium text-bark mb-1">{t('postMemory.storyLabel')}</label>
            {richReady ? (
              <RichTextEditorLazy
                value={richDoc}
                onChange={setRichDoc}
                onPendingChange={setPendingInline}
                disabled={saving}
              />
            ) : (
              <EditorSkeleton />
            )}
          </div>

          {/* Quote */}
          <div>
            <label className="block text-sm font-medium text-bark mb-1">
              {t('postMemory.quoteLabel')} <span className="text-bark-muted font-normal">{t('postMemory.quoteHint')}</span>
            </label>
            <input
              name="quote"
              value={form.quote}
              onChange={handleChange}
              placeholder={t('postMemory.quotePlaceholder')}
              className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
            />
          </div>

          {/* Two columns: Category & Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-bark mb-1">{t('postMemory.categoryLabel')}</label>
              <input
                name="category"
                value={form.category}
                onChange={handleChange}
                placeholder={t('postMemory.categoryPlaceholder')}
                className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-bark mb-1">{t('postMemory.locationLabel')}</label>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder={t('postMemory.locationPlaceholder')}
                className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
              />
            </div>
          </div>

          {/* Two columns: Date & Author */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-bark mb-1">{t('postMemory.dateLabel')}</label>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark outline-none focus:ring-2 focus:ring-kaydo/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-bark mb-1">{t('postMemory.sharedByLabel')}</label>
              <input
                name="authorName"
                value={form.authorName}
                onChange={handleChange}
                placeholder={t('postMemory.sharedByPlaceholder')}
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
            <span className="text-sm text-bark">{t('postMemory.featured')}</span>
          </label>

          {/* Per-card polaroid border — only visible when polaroid style is active */}
          {memoryCardStyle === 'polaroid' && (
            <PolaroidBorderEditor
              value={form.polaroidBorder}
              onChange={(next) => setForm((prev) => ({ ...prev, polaroidBorder: next }))}
            />
          )}

          {saveError && (
            <p className="flex items-center gap-1.5 text-sm text-red-600" role="alert">
              <X className="w-4 h-4 flex-shrink-0" /> {saveError}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || hasUploading || pendingInline > 0 || !richReady}
            className="btn-kaydo w-full flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : hasUploading || pendingInline > 0 ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t('postMemory.uploading')}
              </>
            ) : (
              memory ? t('postMemory.saveChanges') : t('postMemory.shareMemory')
            )}
          </button>
        </form>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
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

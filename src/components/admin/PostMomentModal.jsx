import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Plus, Image as ImageIcon, Video, Camera } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { devError } from '../../utils/devLog'
import { useMediaUploader } from '../../hooks/useMediaUploader'
import EncryptedImage from '../media/EncryptedImage'
import EncryptedVideo from '../media/EncryptedVideo'
import { thumbsFor, buildThumbs, buildTinyPreviews } from '../../utils/mediaThumbs'

function buildInitialImages(moment) {
  if (moment?.images?.length) {
    const thumbs = thumbsFor(moment)
    return moment.images.map((url, i) => ({
      id: `init-img-${i}`,
      preview: url,
      url,
      thumbUrl: thumbs[i] || '',
      uploading: false,
    }))
  }
  return []
}

function buildInitialVideos(moment) {
  if (moment?.videos?.length) {
    return moment.videos.map((v, i) => ({
      id: `init-vid-${i}`,
      preview: v.url,
      url: v.url,
      publicId: v.publicId,
      uploading: false,
    }))
  }
  return []
}

export default function PostMomentModal({ moment, onClose, onSave }) {
  const { t } = useTranslation('memory')
  const { encryptionKey } = useAuth()
  const {
    images,
    videos,
    addImage,
    addVideo,
    removeImage,
    removeVideo,
    videoError,
    imageError,
    hasUploading,
  } = useMediaUploader(encryptionKey, {
    initialImages: buildInitialImages(moment),
    initialVideos: buildInitialVideos(moment),
  })

  const [form, setForm] = useState({
    caption: moment?.caption || '',
    category: moment?.category || '',
    location: moment?.location || '',
    label: moment?.label || '',
  })
  const [mediaError, setMediaError] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const videoFileInputRef = useRef(null)
  const videoCameraInputRef = useRef(null)

  const isEditing = !!moment?.id

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleImagePick = async (e, inputRef) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    if (inputRef?.current) inputRef.current.value = ''
    setMediaError(false)
    await Promise.all(files.map((file) => addImage(file)))
  }

  const handleVideoPick = async (e, inputRef) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (inputRef?.current) inputRef.current.value = ''
    setMediaError(false)
    await addVideo(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const readyImages = images.filter((img) => img.url)
    const readyVideos = videos.filter((v) => v.url)
    if (readyImages.length === 0 && readyVideos.length === 0) {
      setMediaError(true)
      return
    }
    setSaving(true)
    try {
      const thumbs = buildThumbs(readyImages)
      const thumbsTiny = buildTinyPreviews(readyImages)
      const data = {
        ...form,
        images: readyImages.map((img) => img.url),
        // Additive, positionally aligned with `images`; omitted when no image
        // has a thumbnail.
        ...(thumbs ? { thumbs } : {}),
        ...(thumbsTiny ? { thumbsTiny } : {}),
        videos: readyVideos.map((v) => ({ url: v.url, publicId: v.publicId })),
      }
      if (isEditing) {
        await onSave(moment.id, data)
      } else {
        await onSave(data)
      }
      onClose()
    } catch (err) {
      devError('Failed to save moment:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-warm-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-cream-dark sticky top-0 bg-warm-white rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-bark">
            {isEditing ? t('postMoment.titleEdit') : t('postMoment.titleNew')}
          </h2>
          <button onClick={onClose} className="text-bark-muted hover:text-bark">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Multi-image upload */}
          <div>
            <label className="block text-sm font-medium text-bark mb-2">
              {t('postMoment.photos')}
            </label>
            <div className={`flex gap-3 flex-wrap ${mediaError ? 'p-2 ring-2 ring-kaydo rounded-xl' : ''}`}>
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
                {images.length === 0 && videos.length === 0 ? (
                  <>
                    <ImageIcon className="w-6 h-6 text-bark-muted" />
                    <span className="text-xs text-bark-muted text-center leading-tight">{t('postMoment.addPhoto')}</span>
                  </>
                ) : (
                  <Plus className="w-5 h-5 text-bark-muted" />
                )}
              </button>

              {/* Take photo button - mobile only */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-bark-muted flex flex-col items-center justify-center gap-1 hover:border-kaydo hover:bg-cream-dark/50 transition-colors flex-shrink-0 lg:hidden"
              >
                <Camera className="w-6 h-6 text-bark-muted" />
                <span className="text-xs text-bark-muted text-center leading-tight">{t('postMoment.camera')}</span>
              </button>
            </div>
            {imageError && (
              <p className="text-xs text-kaydo mt-1">{imageError}</p>
            )}
          </div>

          {/* Video upload */}
          <div>
            <label className="block text-sm font-medium text-bark mb-2">
              {t('postMoment.shortVideos')} <span className="text-bark-muted font-normal">{t('postMoment.shortVideosHint')}</span>
            </label>
            <div className="flex gap-3 flex-wrap">
              {videos.map((v) => (
                <div key={v.id} className="relative w-20 h-20 flex-shrink-0">
                  {v.preview?.startsWith('blob:') ? (
                    <video
                      src={v.preview}
                      className="w-20 h-20 rounded-xl object-cover bg-black"
                      muted
                      playsInline
                    />
                  ) : (
                    <EncryptedVideo
                      src={v.preview}
                      className="w-20 h-20 rounded-xl object-cover bg-black"
                      controls={false}
                      muted
                      playsInline
                    />
                  )}
                  {/* Video icon overlay */}
                  {!v.uploading && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-7 h-7 rounded-full bg-black/50 flex items-center justify-center">
                        <Video className="w-3.5 h-3.5 text-white" />
                      </div>
                    </div>
                  )}
                  {v.uploading && (
                    <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {!v.uploading && (
                    <button
                      type="button"
                      onClick={() => removeVideo(v.id)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-bark rounded-full flex items-center justify-center text-white hover:bg-bark-light"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}

              {/* Add video button */}
              <button
                type="button"
                onClick={() => videoFileInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-bark-muted flex flex-col items-center justify-center gap-1 hover:border-kaydo hover:bg-cream-dark/50 transition-colors flex-shrink-0"
              >
                <Video className="w-6 h-6 text-bark-muted" />
                <span className="text-xs text-bark-muted text-center leading-tight">{t('postMoment.addVideo')}</span>
              </button>

              {/* Record video button - mobile only */}
              <button
                type="button"
                onClick={() => videoCameraInputRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-bark-muted flex flex-col items-center justify-center gap-1 hover:border-kaydo hover:bg-cream-dark/50 transition-colors flex-shrink-0 lg:hidden"
              >
                <Camera className="w-6 h-6 text-bark-muted" />
                <span className="text-xs text-bark-muted text-center leading-tight">{t('postMoment.record')}</span>
              </button>
            </div>
            {videoError && (
              <p className="text-xs text-kaydo mt-1">{videoError}</p>
            )}
          </div>

          {mediaError && (
            <p className="text-xs text-kaydo -mt-2">{t('postMoment.mediaRequired')}</p>
          )}

          {/* Caption */}
          <div>
            <label className="block text-sm font-medium text-bark mb-1">
              {t('postMoment.captionLabel')} <span className="text-kaydo">*</span>
            </label>
            <textarea
              name="caption"
              value={form.caption}
              onChange={handleChange}
              placeholder={t('postMoment.captionPlaceholder')}
              rows={3}
              className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30 resize-none"
              required
            />
          </div>

          {/* Category & Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-bark mb-1">{t('postMoment.categoryLabel')}</label>
              <input
                name="category"
                value={form.category}
                onChange={handleChange}
                placeholder={t('postMoment.categoryPlaceholder')}
                className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-bark mb-1">{t('postMoment.locationLabel')}</label>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder={t('postMoment.locationPlaceholder')}
                className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
              />
            </div>
          </div>

          {/* Circle label */}
          <div>
            <label className="block text-sm font-medium text-bark mb-1">
              {t('postMoment.labelLabel')} <span className="text-bark-muted font-normal">{t('postMoment.labelHint')}</span>
            </label>
            <input
              name="label"
              value={form.label}
              onChange={handleChange}
              placeholder={t('postMoment.labelPlaceholder')}
              className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
            />
            <p className="text-xs text-bark-muted mt-1">
              {t('postMoment.labelHelp')}
            </p>
          </div>

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
                {t('postMoment.uploading')}
              </>
            ) : isEditing ? (
              t('postMoment.saveChanges')
            ) : (
              t('postMoment.shareMoment')
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

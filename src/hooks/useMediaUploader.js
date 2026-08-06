import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { encryptAndUpload, encryptAndUploadWithThumb } from '../utils/encryptedUpload'
import {
  MAX_VIDEO_DURATION_SECONDS,
  MAX_PLAINTEXT_BYTES,
  formatBytes,
} from '../constants/media'
import { devError } from '../utils/devLog'

// Turns whatever the upload pipeline threw into something a person can act on.
// Anything else would leave the user staring at a spinner that ends in nothing,
// which is exactly the bug this replaces.
export function uploadErrorMessage(err, t) {
  if (err?.code === 'upload/too-large') {
    return t('upload.tooLarge', {
      size: formatBytes(err.size),
      limit: formatBytes(err.limit ?? MAX_PLAINTEXT_BYTES),
    })
  }
  return t('upload.failed')
}

// Probes a local video file for its duration without uploading. Returns 0 on
// failure so callers can decide whether to treat the file as invalid.
export function getVideoDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(video.duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(0)
    }
    video.src = url
  })
}

let nextId = 1
const generateId = () => `upl-${Date.now()}-${nextId++}`

// Shared state + handlers for encrypted image/video upload flows used by
// PostMemoryModal, PostMomentModal, and CreateBlackBoxPage. Eliminates ~200
// lines of duplicated temp-id tracking and error handling.
export function useMediaUploader(encryptionKey, {
  initialImages = [],
  initialVideos = [],
  maxVideoDurationSec = MAX_VIDEO_DURATION_SECONDS,
} = {}) {
  const { t } = useTranslation('common')
  const [images, setImages] = useState(initialImages)
  const [videos, setVideos] = useState(initialVideos)
  const [videoError, setVideoError] = useState('')
  const [imageError, setImageError] = useState('')

  const addImage = useCallback(async (file) => {
    if (!file) return null
    setImageError('')

    if (file.size > MAX_PLAINTEXT_BYTES) {
      setImageError(
        t('upload.tooLarge', {
          size: formatBytes(file.size),
          limit: formatBytes(MAX_PLAINTEXT_BYTES),
        })
      )
      return null
    }

    const preview = URL.createObjectURL(file)
    const tempId = generateId()
    setImages((prev) => [...prev, { id: tempId, preview, url: '', uploading: true }])

    try {
      // Images get a second, downscaled encrypted asset so grids and story
      // circles stop pulling the full-resolution original. thumbUrl is '' when
      // one could not be made; every reader falls back to `url`.
      const { url, publicId, thumbUrl, thumbPublicId } =
        await encryptAndUploadWithThumb(file, encryptionKey)
      setImages((prev) =>
        prev.map((img) =>
          img.id === tempId
            ? { ...img, url, publicId, thumbUrl, thumbPublicId, uploading: false }
            : img
        )
      )
      return { id: tempId, url, publicId, thumbUrl, thumbPublicId }
    } catch (err) {
      devError('Image upload failed:', err)
      setImages((prev) => prev.filter((img) => img.id !== tempId))
      setImageError(uploadErrorMessage(err, t))
      return null
    }
  }, [encryptionKey, t])

  const addVideo = useCallback(async (file) => {
    if (!file) return null
    setVideoError('')

    const duration = await getVideoDuration(file)
    if (duration > maxVideoDurationSec) {
      setVideoError(t('upload.videoTooLong', { seconds: maxVideoDurationSec }))
      return null
    }

    // A short clip is not automatically a small one: 13 seconds of 4K comes to
    // tens of megabytes, well past Cloudinary's raw cap. Checked here so the
    // message appears immediately rather than after a doomed upload.
    if (file.size > MAX_PLAINTEXT_BYTES) {
      setVideoError(
        t('upload.tooLarge', {
          size: formatBytes(file.size),
          limit: formatBytes(MAX_PLAINTEXT_BYTES),
        })
      )
      return null
    }

    const preview = URL.createObjectURL(file)
    const tempId = generateId()
    setVideos((prev) => [
      ...prev,
      { id: tempId, preview, url: '', publicId: '', title: '', uploading: true },
    ])

    try {
      const { url, publicId } = await encryptAndUpload(file, encryptionKey)
      setVideos((prev) =>
        prev.map((v) => (v.id === tempId ? { ...v, url, publicId, uploading: false } : v))
      )
      return { id: tempId, url, publicId }
    } catch (err) {
      devError('Video upload failed:', err)
      setVideos((prev) => prev.filter((v) => v.id !== tempId))
      setVideoError(uploadErrorMessage(err, t))
      return null
    }
  }, [encryptionKey, maxVideoDurationSec, t])

  const removeImage = useCallback((id) => {
    setImages((prev) => prev.filter((img) => img.id !== id))
  }, [])

  const removeVideo = useCallback((id) => {
    setVideos((prev) => prev.filter((v) => v.id !== id))
  }, [])

  const hasUploading = useMemo(
    () => images.some((img) => img.uploading) || videos.some((v) => v.uploading),
    [images, videos]
  )

  return {
    images,
    videos,
    setImages,
    setVideos,
    addImage,
    addVideo,
    removeImage,
    removeVideo,
    videoError,
    setVideoError,
    imageError,
    setImageError,
    hasUploading,
  }
}

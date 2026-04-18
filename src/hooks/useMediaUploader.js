import { useCallback, useMemo, useState } from 'react'
import { encryptAndUpload } from '../utils/encryptedUpload'
import { MAX_VIDEO_DURATION_SECONDS } from '../constants/media'
import { devError } from '../utils/devLog'

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
  const [images, setImages] = useState(initialImages)
  const [videos, setVideos] = useState(initialVideos)
  const [videoError, setVideoError] = useState('')

  const addImage = useCallback(async (file) => {
    if (!file) return null
    const preview = URL.createObjectURL(file)
    const tempId = generateId()
    setImages((prev) => [...prev, { id: tempId, preview, url: '', uploading: true }])

    try {
      const { url, publicId } = await encryptAndUpload(file, encryptionKey)
      setImages((prev) =>
        prev.map((img) => (img.id === tempId ? { ...img, url, publicId, uploading: false } : img))
      )
      return { id: tempId, url, publicId }
    } catch (err) {
      devError('Image upload failed:', err)
      setImages((prev) => prev.filter((img) => img.id !== tempId))
      return null
    }
  }, [encryptionKey])

  const addVideo = useCallback(async (file) => {
    if (!file) return null
    setVideoError('')

    const duration = await getVideoDuration(file)
    if (duration > maxVideoDurationSec) {
      setVideoError(`Video must be ${maxVideoDurationSec} seconds or shorter.`)
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
      return null
    }
  }, [encryptionKey, maxVideoDurationSec])

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
    hasUploading,
  }
}

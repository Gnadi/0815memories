import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { encryptAndUpload } from '../utils/encryptedUpload'
import { devError } from '../utils/devLog'

/**
 * Handles uploading a photo for the scrapbook editor.
 * Returns: { upload(file) -> url, uploading, session } where `session` is
 * the list of URLs uploaded during this editor session (so the PhotoBar can
 * show them immediately alongside memories).
 */
export function useScrapbookPhotoUpload() {
  const { encryptionKey } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [session, setSession] = useState([])

  const upload = async (file) => {
    if (!file) return null
    setUploading(true)
    try {
      const { url } = await encryptAndUpload(file, encryptionKey)
      setSession((prev) => (prev.includes(url) ? prev : [url, ...prev]))
      return url
    } catch (err) {
      devError('Scrapbook upload failed', err)
      return null
    } finally {
      setUploading(false)
    }
  }

  return { upload, uploading, session }
}

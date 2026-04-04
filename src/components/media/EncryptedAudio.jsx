import { useRef, useEffect } from 'react'
import useDecryptedMedia from './useDecryptedMedia'

/**
 * EncryptedAudio decrypts an encrypted audio URL and provides
 * access to the underlying <audio> element via audioRef.
 *
 * Unlike EncryptedImage/Video, audio players often have custom UIs,
 * so this component exposes the audio element ref rather than rendering controls.
 */
export default function EncryptedAudio({ src, audioRef: externalRef, onEnded, onLoadedMetadata, className = '' }) {
  const { decryptedUrl, loading } = useDecryptedMedia(src, 'audio/*')
  const internalRef = useRef(null)
  const ref = externalRef || internalRef

  // Update audio src when decrypted URL changes
  useEffect(() => {
    if (ref.current && decryptedUrl) {
      ref.current.src = decryptedUrl
    }
  }, [decryptedUrl, ref])

  if (loading || !decryptedUrl) {
    return <audio ref={ref} className={className} />
  }

  return (
    <audio
      ref={ref}
      src={decryptedUrl}
      onEnded={onEnded}
      onLoadedMetadata={onLoadedMetadata}
      className={className}
    />
  )
}

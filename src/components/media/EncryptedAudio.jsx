import { useRef } from 'react'
import useDecryptedMedia from './useDecryptedMedia'

/**
 * EncryptedAudio decrypts an encrypted audio URL and provides
 * access to the underlying <audio> element via audioRef.
 *
 * Unlike EncryptedImage/Video, audio players often have custom UIs,
 * so this component exposes the audio element ref rather than rendering controls.
 */
export default function EncryptedAudio({ src, audioRef: externalRef, onEnded, onLoadedMetadata, className = '', ...rest }) {
  const { decryptedUrl } = useDecryptedMedia(src, 'audio/*')
  const internalRef = useRef(null)
  const ref = externalRef || internalRef

  // One element for both states: React swaps the src attribute in place rather
  // than replacing the node, so a ref handed to a custom player stays valid.
  return (
    <audio
      ref={ref}
      src={decryptedUrl || undefined}
      onEnded={onEnded}
      onLoadedMetadata={onLoadedMetadata}
      className={className}
      {...rest}
    />
  )
}

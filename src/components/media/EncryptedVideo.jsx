import { memo } from 'react'
import useDecryptedMedia from './useDecryptedMedia'
import { PLACEHOLDER_CLASSES } from './placeholder'

// Not lazily gated: videos are often mounted inside custom players whose
// element carries no layout of its own, so an IntersectionObserver would never
// report them as visible.
function EncryptedVideo({ src, className = '', controls = true, playsInline = true, ...rest }) {
  const { decryptedUrl, loading } = useDecryptedMedia(src, 'video/*')

  if (!src) return null

  return (
    <video
      src={decryptedUrl || undefined}
      className={loading ? `${className} ${PLACEHOLDER_CLASSES}` : className}
      controls={controls}
      playsInline={playsInline}
      {...rest}
    />
  )
}

export default memo(EncryptedVideo)

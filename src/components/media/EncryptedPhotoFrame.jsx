import { memo } from 'react'
import useDecryptedMedia from './useDecryptedMedia'
import { TRANSPARENT_PIXEL, PLACEHOLDER_CLASSES } from './placeholder'

/**
 * A photo shown over a blurred copy of itself, so portrait/landscape shots fill
 * the square frame without letterboxing.
 *
 * All three memory card styles used to render two <EncryptedImage>s for this,
 * which meant two decrypt hooks — two subscriptions, two states, two effects —
 * for a single photo. The network round trip was deduped, the React work was
 * not. Decrypting once and painting both layers halves the hook instances on
 * the home feed.
 */
function EncryptedPhotoFrame({
  src,
  thumbSrc,
  alt = '',
  backdropClassName = 'absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-70',
  photoClassName = 'relative z-[1] w-full h-full object-contain',
}) {
  const { decryptedUrl, loading, ref } = useDecryptedMedia(thumbSrc || src, 'image/*', { lazy: true })

  if (!src && !thumbSrc) return null

  const url = decryptedUrl || TRANSPARENT_PIXEL

  return (
    <>
      {/* Also the observed element: it always spans the whole frame. */}
      <img
        ref={ref}
        src={url}
        alt=""
        aria-hidden="true"
        decoding="async"
        className={loading ? `${backdropClassName} ${PLACEHOLDER_CLASSES}` : backdropClassName}
      />
      <img
        src={url}
        alt={loading ? '' : alt}
        decoding="async"
        className={photoClassName}
      />
    </>
  )
}

export default memo(EncryptedPhotoFrame)

import { memo } from 'react'
import useDecryptedMedia from './useDecryptedMedia'
import { BLANK_IMAGE, PLACEHOLDER_CLASSES } from './placeholder'

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

  const url = decryptedUrl || BLANK_IMAGE

  return (
    <>
      {/* Also the observed element: it always spans the whole frame. */}
      <img
        ref={ref}
        src={url}
        alt=""
        aria-hidden="true"
        decoding="async"
        className={backdropClassName}
      />
      {/* The placeholder rides the front layer, not the backdrop: the backdrop
          is blurred, and a 40px blur erases a 28px spinner. Both layers span
          the frame, so the tint covers it either way. */}
      <img
        src={url}
        alt={loading ? '' : alt}
        decoding="async"
        className={loading ? `${photoClassName} ${PLACEHOLDER_CLASSES}` : photoClassName}
      />
    </>
  )
}

export default memo(EncryptedPhotoFrame)

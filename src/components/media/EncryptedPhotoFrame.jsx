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
  tinyPreview,
  alt = '',
  backdropClassName = 'absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-70',
  photoClassName = 'relative z-[1] w-full h-full object-contain',
}) {
  const { decryptedUrl, loading, ref } = useDecryptedMedia(thumbSrc || src, 'image/*', { lazy: true })

  if (!src && !thumbSrc) return null

  // The blur-up preview (see utils/mediaThumbs.js) needs no extra element here:
  // this component already paints the photo twice, so both layers just point at
  // the ~20px copy until the real one lands. It arrives decrypted on the
  // document, so there is nothing to wait for.
  const preview = loading && tinyPreview ? tinyPreview : null
  const url = decryptedUrl || preview || BLANK_IMAGE

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
          the frame, so the tint covers it either way.

          With a preview there is no spinner to place — the frame already shows
          the photo's own colours. The front layer gets its own blur so 20px
          does not read as a pixelated mistake. */}
      <img
        src={url}
        alt={loading ? '' : alt}
        decoding="async"
        className={
          loading && !preview ? `${photoClassName} ${PLACEHOLDER_CLASSES}` : photoClassName
        }
        style={preview ? { filter: 'blur(8px)' } : undefined}
      />
    </>
  )
}

export default memo(EncryptedPhotoFrame)

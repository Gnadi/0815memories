import { memo } from 'react'
import useDecryptedMedia from './useDecryptedMedia'
import { BLANK_IMAGE, PLACEHOLDER_CLASSES } from './placeholder'

/**
 * `thumbSrc` — a downscaled encrypted copy to load instead of `src`. Pass it
 * wherever the image renders small; leave it off for heroes and lightboxes,
 * which should always get the full-resolution original. An empty or missing
 * thumbSrc falls back to `src` on its own.
 *
 * `tinyPreview` — an already-decrypted `data:` URL of a ~20px copy of this exact
 * photo, carried on the document (see utils/mediaThumbs.js). When present it is
 * shown blurred *instead of* the grey placeholder, so the wait looks like the
 * photo arriving rather than a spinner. It costs no request and no decrypt here:
 * the feed decrypted it with the text fields.
 *
 * The preview is a separate element underneath rather than a swapped `src`,
 * because a single <img> whose src changes re-decodes, and the one-element
 * invariant is what stops the browser re-decoding on every mount.
 */
function EncryptedImage({ src, thumbSrc, tinyPreview, alt = '', className = '', style, onClick, ...rest }) {
  const { decryptedUrl, loading, ref } = useDecryptedMedia(thumbSrc || src, 'image/*', { lazy: true })

  if (!src && !thumbSrc) return null

  const showPreview = loading && !!tinyPreview

  const image = (
    <img
      ref={ref}
      src={decryptedUrl || BLANK_IMAGE}
      alt={loading ? '' : alt}
      // With a preview underneath, the grey shimmer would sit on top of it.
      className={loading && !showPreview ? `${className} ${PLACEHOLDER_CLASSES}` : className}
      style={showPreview ? { ...style, opacity: 0 } : style}
      onClick={onClick}
      decoding="async"
      {...rest}
    />
  )

  if (!showPreview) return image

  return (
    <span className="relative block isolate">
      <img
        src={tinyPreview}
        alt=""
        aria-hidden="true"
        className={`${className} absolute inset-0`}
        // scale hides the blur's soft edges, which would otherwise show as a
        // pale border around the frame.
        style={{ ...style, filter: 'blur(12px)', transform: 'scale(1.08)' }}
        decoding="async"
      />
      {image}
    </span>
  )
}

export default memo(EncryptedImage)

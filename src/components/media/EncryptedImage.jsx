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
 *
 * Both elements are siblings with stable keys, and no wrapper. A wrapper was
 * two bugs at once: swapping `<img>` for `<span><img/><img/></span>` when the
 * photo landed is a change of element type, so React tore the photo down and
 * remounted it — the re-decode the invariant above exists to prevent. And a
 * caller whose className is `absolute` (the story viewer, the moments grid)
 * left the wrapper with nothing in flow to give it height, so it collapsed to
 * zero and took both layers with it. Siblings position against the caller's own
 * container, which is what every call site already establishes.
 */
function EncryptedImage({ src, thumbSrc, tinyPreview, alt = '', className = '', style, onClick, ...rest }) {
  const { decryptedUrl, loading, error, ref } = useDecryptedMedia(thumbSrc || src, 'image/*', { lazy: true })

  if (!src && !thumbSrc) return null

  // On failure the hook no longer falls back to the ciphertext URL, so there is
  // nothing to paint. The blurred preview is the better of the two remaining
  // answers: the photo's own colours rather than an empty frame.
  const showPreview = (loading || !!error) && !!tinyPreview

  return (
    <>
      {showPreview && (
        <img
          key="preview"
          src={tinyPreview}
          alt=""
          aria-hidden="true"
          className={`${className} absolute inset-0`}
          // scale hides the blur's soft edges, which would otherwise show as a
          // pale border around the frame.
          style={{ ...style, filter: 'blur(12px)', transform: 'scale(1.08)' }}
          decoding="async"
        />
      )}
      <img
        key="photo"
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
    </>
  )
}

export default memo(EncryptedImage)

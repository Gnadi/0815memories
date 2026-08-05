import { memo } from 'react'
import useDecryptedMedia from './useDecryptedMedia'
import { TRANSPARENT_PIXEL, PLACEHOLDER_CLASSES } from './placeholder'

/**
 * `thumbSrc` — a downscaled encrypted copy to load instead of `src`. Pass it
 * wherever the image renders small; leave it off for heroes and lightboxes,
 * which should always get the full-resolution original. An empty or missing
 * thumbSrc falls back to `src` on its own.
 */
function EncryptedImage({ src, thumbSrc, alt = '', className = '', style, onClick, ...rest }) {
  const { decryptedUrl, loading, ref } = useDecryptedMedia(thumbSrc || src, 'image/*', { lazy: true })

  if (!src && !thumbSrc) return null

  return (
    <img
      ref={ref}
      src={decryptedUrl || TRANSPARENT_PIXEL}
      alt={loading ? '' : alt}
      className={loading ? `${className} ${PLACEHOLDER_CLASSES}` : className}
      style={style}
      onClick={onClick}
      decoding="async"
      {...rest}
    />
  )
}

export default memo(EncryptedImage)

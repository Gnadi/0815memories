import { memo } from 'react'
import useDecryptedMedia from './useDecryptedMedia'
import { BLANK_IMAGE, PLACEHOLDER_CLASSES, PLACEHOLDER_CLASSES_DARK } from './placeholder'

/**
 * `thumbSrc` — a downscaled encrypted copy to load instead of `src`. Pass it
 * wherever the image renders small; leave it off for heroes and lightboxes,
 * which should always get the full-resolution original. An empty or missing
 * thumbSrc falls back to `src` on its own.
 *
 * `tone` — which loading placeholder to paint underneath. Defaults to the cream
 * tint that suits the app's light surfaces; pass `"dark"` on black backdrops.
 */
function EncryptedImage({ src, thumbSrc, alt = '', className = '', style, onClick, tone = 'light', ...rest }) {
  const { decryptedUrl, loading, ref } = useDecryptedMedia(thumbSrc || src, 'image/*', { lazy: true })

  if (!src && !thumbSrc) return null

  return (
    <img
      ref={ref}
      src={decryptedUrl || BLANK_IMAGE}
      alt={loading ? '' : alt}
      className={
        loading
          ? `${className} ${tone === 'dark' ? PLACEHOLDER_CLASSES_DARK : PLACEHOLDER_CLASSES}`
          : className
      }
      style={style}
      onClick={onClick}
      decoding="async"
      {...rest}
    />
  )
}

export default memo(EncryptedImage)

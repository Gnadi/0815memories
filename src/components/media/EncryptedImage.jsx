import { memo } from 'react'
import useDecryptedMedia from './useDecryptedMedia'
import { TRANSPARENT_PIXEL, PLACEHOLDER_CLASSES } from './placeholder'

function EncryptedImage({ src, alt = '', className = '', style, onClick, ...rest }) {
  const { decryptedUrl, loading, ref } = useDecryptedMedia(src, 'image/*', { lazy: true })

  if (!src) return null

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

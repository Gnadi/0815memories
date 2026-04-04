import useDecryptedMedia from './useDecryptedMedia'

export default function EncryptedImage({ src, alt = '', className = '', style, onClick, ...rest }) {
  const { decryptedUrl, loading } = useDecryptedMedia(src, 'image/*')

  if (!src) return null

  if (loading) {
    return (
      <div className={className} style={style}>
        <div className="w-full h-full bg-cream-dark animate-pulse rounded-xl" />
      </div>
    )
  }

  return (
    <img
      src={decryptedUrl}
      alt={alt}
      className={className}
      style={style}
      onClick={onClick}
      {...rest}
    />
  )
}

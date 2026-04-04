import useDecryptedMedia from './useDecryptedMedia'

export default function EncryptedVideo({ src, className = '', controls = true, playsInline = true, ...rest }) {
  const { decryptedUrl, loading } = useDecryptedMedia(src, 'video/*')

  if (!src) return null

  if (loading) {
    return (
      <div className={className}>
        <div className="w-full h-full bg-cream-dark animate-pulse rounded-xl min-h-[120px]" />
      </div>
    )
  }

  return (
    <video
      src={decryptedUrl}
      className={className}
      controls={controls}
      playsInline={playsInline}
      {...rest}
    />
  )
}

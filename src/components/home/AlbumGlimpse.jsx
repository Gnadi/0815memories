export default function AlbumGlimpse({ memories }) {
  const photos = memories
    .filter((m) => m.imageUrl)
    .slice(0, 6)

  if (photos.length === 0) return null

  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-bark mb-4">Family Album Glimpse</h2>
      <div className="grid grid-cols-3 gap-2 rounded-2xl overflow-hidden">
        {photos.map((photo, i) => (
          <div
            key={photo.id}
            className={`relative overflow-hidden ${
              i === 0 ? 'col-span-2 row-span-2' : ''
            }`}
          >
            <img
              src={photo.imageUrl}
              alt={photo.title || 'Family photo'}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              style={{ minHeight: i === 0 ? '240px' : '116px' }}
            />
            {photo.title && i === 0 && (
              <div className="absolute bottom-3 left-3 text-white text-sm font-semibold drop-shadow-lg">
                {photo.title}
              </div>
            )}
          </div>
        ))}

        {/* Fill remaining slots with placeholders */}
        {photos.length < 5 &&
          Array.from({ length: Math.min(5, 5 - photos.length) }).map((_, i) => (
            <div
              key={`placeholder-${i}`}
              className="bg-cream-dark flex items-center justify-center"
              style={{ minHeight: '116px' }}
            >
              <AlbumPlaceholder index={photos.length + i} />
            </div>
          ))}
      </div>
    </section>
  )
}

function AlbumPlaceholder({ index }) {
  const icons = [
    // Mountain
    <svg key="m" viewBox="0 0 60 60" className="w-10 h-10 text-bark-muted opacity-30">
      <path d="M5,50 L20,20 L30,35 L40,15 L55,50Z" fill="currentColor" />
    </svg>,
    // Coffee cup
    <svg key="c" viewBox="0 0 60 60" className="w-10 h-10 text-bark-muted opacity-30">
      <rect x="12" y="20" width="30" height="28" rx="4" fill="currentColor" />
      <path d="M42,28 Q54,28 54,38 Q54,48 42,48" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M20,18 Q22,8 24,18" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M28,18 Q30,6 32,18" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>,
    // Sun/beach
    <svg key="s" viewBox="0 0 60 60" className="w-10 h-10 text-bark-muted opacity-30">
      <circle cx="30" cy="22" r="10" fill="currentColor" />
      <path d="M0,40 Q15,30 30,40 Q45,50 60,40 L60,60 L0,60Z" fill="currentColor" />
    </svg>,
    // Heart
    <svg key="h" viewBox="0 0 60 60" className="w-10 h-10 text-bark-muted opacity-30">
      <path d="M30,50 L10,30 Q2,18 15,15 Q25,12 30,22 Q35,12 45,15 Q58,18 50,30Z" fill="currentColor" />
    </svg>,
  ]
  return icons[index % icons.length]
}

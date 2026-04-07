import { useNavigate } from 'react-router-dom'
import { timeAgo } from '../../utils/helpers'
import EncryptedImage from '../media/EncryptedImage'

export default function FeaturedJourney({ memory }) {
  const navigate = useNavigate()

  if (!memory) return <FeaturedPlaceholder />

  return (
    <section
      className="mb-8 cursor-pointer group"
      onClick={() => navigate(`/memory/${memory.id}`)}
    >
      <div className="relative rounded-2xl overflow-hidden h-80 lg:h-[480px]">
        {memory.imageUrl ? (
          <EncryptedImage
            src={memory.imageUrl}
            alt={memory.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <FeaturedPlaceholderImage />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6 text-white">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-kaydo text-white text-xs font-bold px-3 py-1 rounded-full uppercase">
              {memory.category || 'New Journey'}
            </span>
            <span className="text-sm opacity-80">{timeAgo(memory.createdAt)}</span>
          </div>
          <h3 className="text-2xl lg:text-3xl font-bold font-serif mb-1">{memory.title}</h3>
          <p className="text-sm opacity-90 line-clamp-2">{memory.content}</p>
        </div>
      </div>
    </section>
  )
}

function FeaturedPlaceholder() {
  return (
    <section className="mb-8">
      <div className="relative rounded-2xl overflow-hidden h-80 lg:h-[480px]">
        <FeaturedPlaceholderImage />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6 text-white">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-kaydo text-white text-xs font-bold px-3 py-1 rounded-full uppercase">
              New Journey
            </span>
            <span className="text-sm opacity-80">Awaiting memories...</span>
          </div>
          <h3 className="text-2xl lg:text-3xl font-bold font-serif mb-1">
            Sunday at the Vineyard
          </h3>
          <p className="text-sm opacity-90">
            The whole gang finally made it! Share your first memory to get started.
          </p>
        </div>
      </div>
    </section>
  )
}

function FeaturedPlaceholderImage() {
  return (
    <svg viewBox="0 0 800 400" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="featSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#87CEEB" />
          <stop offset="50%" stopColor="#E8A87C" />
          <stop offset="100%" stopColor="#D4A574" />
        </linearGradient>
      </defs>
      <rect width="800" height="400" fill="url(#featSky)" />
      {/* Mountains */}
      <path d="M0,300 L150,150 L300,280 L450,120 L600,250 L750,160 L800,200 L800,400 L0,400Z" fill="#5B7553" opacity="0.6" />
      <path d="M0,350 L200,220 L400,320 L600,200 L800,300 L800,400 L0,400Z" fill="#4A6741" opacity="0.7" />
      {/* Water */}
      <rect x="0" y="340" width="800" height="60" fill="#4A90A4" opacity="0.5" />
      {/* Sun */}
      <circle cx="650" cy="120" r="40" fill="#FFD700" opacity="0.6" />
      {/* Family silhouettes */}
      <g transform="translate(300, 240)">
        <circle cx="0" cy="-25" r="12" fill="#8B4513" />
        <ellipse cx="0" cy="5" rx="14" ry="22" fill="#A0522D" />
        <circle cx="40" cy="-20" r="10" fill="#CD853F" />
        <ellipse cx="40" cy="8" rx="12" ry="20" fill="#D2691E" />
        <circle cx="-35" cy="-22" r="11" fill="#DEB887" />
        <ellipse cx="-35" cy="6" rx="13" ry="21" fill="#D2B48C" />
        <circle cx="15" cy="-5" r="8" fill="#F4A460" />
        <ellipse cx="15" cy="16" rx="9" ry="15" fill="#DEB887" />
      </g>
    </svg>
  )
}

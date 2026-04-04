import { Plus, Video } from 'lucide-react'
import { formatRelativeDate } from '../../utils/helpers'
import { useAuth } from '../../context/AuthContext'
import EncryptedImage from '../media/EncryptedImage'

export default function DailyMoments({ moments, onAddMoment, onMomentClick, onViewAll }) {
  const { isAdmin } = useAuth()

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-bark">Daily Moments</h2>
        <button onClick={onViewAll} className="text-sm font-semibold text-hearth hover:text-hearth-dark">
          VIEW ALL
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
        {/* Add moment button */}
        {isAdmin && (
          <button
            onClick={onAddMoment}
            className="flex flex-col items-center gap-1.5 flex-shrink-0"
          >
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-bark-muted flex items-center justify-center">
              <Plus className="w-6 h-6 text-bark-muted" />
            </div>
            <span className="text-xs text-bark-muted">Add</span>
          </button>
        )}

        {/* Moment circles */}
        {moments.map((moment, index) => (
          <button
            key={moment.id}
            onClick={() => onMomentClick?.(index)}
            className="flex flex-col items-center gap-1.5 flex-shrink-0"
          >
            <div className="story-ring">
              <div className="story-ring-inner relative">
                {moment.images?.[0] ? (
                  <EncryptedImage
                    src={moment.images[0]}
                    alt={moment.caption}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : moment.videos?.length > 0 ? (
                  <div className="w-16 h-16 rounded-full bg-bark/20 flex items-center justify-center">
                    <Video className="w-6 h-6 text-bark-muted" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-cream-dark flex items-center justify-center">
                    <MomentPlaceholder />
                  </div>
                )}
                {/* Video badge: shown when moment has videos alongside images */}
                {moment.images?.[0] && moment.videos?.length > 0 && (
                  <span className="absolute bottom-0 right-0 w-5 h-5 bg-hearth rounded-full flex items-center justify-center shadow">
                    <Video className="w-3 h-3 text-white" />
                  </span>
                )}
              </div>
            </div>
            <span className="text-xs text-bark-light max-w-[68px] truncate">
              {moment.label || formatRelativeDate(moment.date)}
            </span>
          </button>
        ))}

        {/* Show placeholders if no moments */}
        {moments.length === 0 && (
          <>
            {['Today', 'Yesterday', 'Oct 12', 'Oct 8'].map((label, i) => (
              <div key={label} className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div className={i === 0 ? 'story-ring' : ''}>
                  <div className={i === 0 ? 'story-ring-inner' : ''}>
                    <div className="w-16 h-16 rounded-full bg-cream-dark flex items-center justify-center">
                      <MomentPlaceholder index={i} />
                    </div>
                  </div>
                </div>
                <span className="text-xs text-bark-light">{label}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </section>
  )
}

function MomentPlaceholder({ index = 0 }) {
  const colors = ['#D2691E', '#DEB887', '#8B7355', '#CD853F']
  return (
    <svg viewBox="0 0 40 40" className="w-10 h-10">
      <circle cx="20" cy="20" r="18" fill={colors[index % colors.length]} opacity="0.3" />
      <circle cx="20" cy="16" r="6" fill={colors[index % colors.length]} opacity="0.5" />
      <ellipse cx="20" cy="30" rx="10" ry="7" fill={colors[index % colors.length]} opacity="0.5" />
    </svg>
  )
}

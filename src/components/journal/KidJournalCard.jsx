import { User, BookOpen, Star, ChevronRight, Plus } from 'lucide-react'
import EncryptedImage from '../media/EncryptedImage'

export default function KidJournalCard({ kid, journalCount, onViewArchive, onEdit, onDelete }) {
  const birthdate = kid.birthdate?.toDate ? kid.birthdate.toDate() : new Date(kid.birthdate)
  const age = Math.floor((new Date() - birthdate) / (365.25 * 24 * 60 * 60 * 1000))
  const formattedBirth = birthdate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="bg-warm-white rounded-2xl p-5 shadow-sm border border-cream-dark flex flex-col gap-4">
      {/* Kid identity */}
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-cream-dark flex-shrink-0 flex items-center justify-center">
          {kid.profilePhoto ? (
            <EncryptedImage src={kid.profilePhoto} alt={kid.name} className="w-full h-full object-cover" />
          ) : (
            <User className="w-8 h-8 text-bark-muted" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-bark truncate">{kid.name}</h3>
          <p className="text-sm text-bark-muted">
            Born {formattedBirth}
            {age >= 0 && ` · ${age} yr${age !== 1 ? 's' : ''} old`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onEdit}
            className="text-bark-muted hover:text-bark text-xs underline underline-offset-2"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="text-red-400 hover:text-red-600 text-xs underline underline-offset-2"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Stats */}
      {journalCount > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-cream rounded-xl text-sm text-bark">
            <BookOpen className="w-4 h-4 text-hearth flex-shrink-0" />
            <span>{journalCount} {journalCount === 1 ? 'Letter' : 'Letters'} written</span>
          </div>
        </div>
      ) : (
        <p className="text-sm text-bark-muted italic">No letters written yet — start today.</p>
      )}

      {/* Action */}
      <button
        onClick={onViewArchive}
        className="flex items-center gap-1 text-sm font-semibold text-hearth hover:text-hearth/80 transition-colors mt-auto"
      >
        {journalCount > 0 ? (
          <>View Archive <ChevronRight className="w-4 h-4" /></>
        ) : (
          <>Start Journal <Plus className="w-4 h-4" /></>
        )}
      </button>
    </div>
  )
}

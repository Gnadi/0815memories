import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, PenLine, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useKids } from '../hooks/useKids'
import { useJournals } from '../hooks/useJournals'
import JournalEntryCard from '../components/journal/JournalEntryCard'
import Sidebar from '../components/layout/Sidebar'

export default function JournalArchivePage() {
  const { isAdmin, familyId } = useAuth()
  const navigate = useNavigate()
  const { childId } = useParams()
  const { kids } = useKids(familyId)
  const { journals, loading, deleteJournal } = useJournals(familyId, childId)

  useEffect(() => {
    if (!isAdmin) navigate('/home')
  }, [isAdmin, navigate])

  const kid = kids.find((k) => k.id === childId)

  if (!isAdmin) return null

  const birthdate = kid?.birthdate?.toDate ? kid.birthdate.toDate() : kid?.birthdate ? new Date(kid.birthdate) : null
  const age = birthdate ? Math.floor((new Date() - birthdate) / (365.25 * 24 * 60 * 60 * 1000)) : null

  return (
    <div className="min-h-screen bg-cream flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-cream border-b border-cream-dark px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/journal')}
            className="text-bark-muted hover:text-bark"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {kid?.profilePhoto ? (
              <img
                src={kid.profilePhoto}
                alt={kid?.name}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-cream-dark flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-bark-muted" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-bold text-bark truncate">{kid?.name || 'Journal'}</h1>
              {age !== null && (
                <p className="text-xs text-bark-muted">{age} years old</p>
              )}
            </div>
          </div>
          <button
            onClick={() => navigate(`/journal/${childId}/new`)}
            className="btn-hearth flex items-center gap-1.5 text-sm py-2 px-3"
          >
            <PenLine className="w-4 h-4" />
            Write
          </button>
        </div>

        <div className="p-4 md:p-8 max-w-2xl mx-auto w-full">
          {/* Stats */}
          <div className="flex items-center gap-4 mb-6 text-sm text-bark-muted">
            <span>{journals.length} {journals.length === 1 ? 'letter' : 'letters'}</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-hearth border-t-transparent rounded-full animate-spin" />
            </div>
          ) : journals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <p className="font-semibold text-bark">No letters written yet</p>
              <p className="text-sm text-bark-muted">
                Write your first letter to {kid?.name || 'your child'}.
              </p>
              <button
                onClick={() => navigate(`/journal/${childId}/new`)}
                className="btn-hearth flex items-center gap-2"
              >
                <PenLine className="w-4 h-4" />
                Write First Letter
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {journals.map((entry) => (
                <JournalEntryCard
                  key={entry.id}
                  entry={entry}
                  onEdit={() => navigate(`/journal/${childId}/edit/${entry.id}`)}
                  onDelete={() => {
                    if (confirm('Delete this letter permanently?')) {
                      deleteJournal(entry.id)
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

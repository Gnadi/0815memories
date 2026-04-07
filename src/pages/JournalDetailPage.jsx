import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { EMOTIONS } from '../constants/emotions'
import { useAuth } from '../context/AuthContext'
import { useKids } from '../hooks/useKids'
import { useJournals } from '../hooks/useJournals'
import EncryptedImage from '../components/media/EncryptedImage'
import EncryptedVideo from '../components/media/EncryptedVideo'
import EncryptedAudio from '../components/media/EncryptedAudio'

export default function JournalDetailPage() {
  const { childId, entryId } = useParams()
  const { isAdmin, familyId, encryptionKey } = useAuth()
  const navigate = useNavigate()
  const { kids } = useKids(familyId, encryptionKey)
  const { journals, deleteJournal } = useJournals(familyId, childId, encryptionKey)

  const kid = kids.find((k) => k.id === childId)
  const entry = journals.find((j) => j.id === entryId)

  useEffect(() => {
    if (!isAdmin) navigate('/home')
  }, [isAdmin, navigate])

  if (!isAdmin) return null

  const emotion = EMOTIONS.find((e) => e.key === entry?.emotion) || EMOTIONS[1]
  const date = entry?.date?.toDate ? entry.date.toDate() : entry?.date ? new Date(entry.date) : null
  const formattedDate = date?.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const handleDelete = () => {
    if (confirm('Delete this letter permanently?')) {
      deleteJournal(entryId)
      navigate(`/journal/${childId}`)
    }
  }

  return (
    <div className="h-[100dvh] flex flex-col relative overflow-hidden">

      {/* Background */}
      <div className="absolute inset-0 -z-10">
        {kid?.profilePhoto ? (
          <EncryptedImage src={kid.profilePhoto} className="w-full h-full object-cover" alt="" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-rose-200 via-orange-100 to-amber-200" />
        )}
        <div className="absolute inset-0 bg-black/35" />
      </div>

      {/* Top bar */}
      <div className="px-4 pt-4 pb-1 flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => navigate(`/journal/${childId}`)}
          className="w-9 h-9 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/30 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/journal/${childId}/edit/${entryId}`)}
            className="w-9 h-9 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/30 transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            className="w-9 h-9 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-red-400 hover:bg-black/30 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Reading card */}
      <div className="h-[85dvh] md:flex-1 bg-white/[0.92] backdrop-blur-md rounded-t-3xl mx-1 flex flex-col min-h-0 shadow-2xl overflow-hidden">

        {/* Coral accent line */}
        <div className="w-10 h-1 rounded-full bg-kaydo mx-5 mt-3 flex-shrink-0" />

        {/* Loading state */}
        {!entry ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-kaydo border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 pb-8">

            {/* Emotion + date */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${emotion.bg} ${emotion.text}`}>
                {emotion.emoji} {emotion.label}
              </span>
              {formattedDate && (
                <span className="text-xs text-stone-400">{formattedDate}</span>
              )}
            </div>

            {/* Volume */}
            {entry.volume && (
              <p className="text-xs font-semibold text-kaydo uppercase tracking-wide">{entry.volume}</p>
            )}

            {/* Title */}
            {entry.title && (
              <h1 className="text-2xl font-bold text-stone-800 leading-tight">{entry.title}</h1>
            )}

            {/* Content */}
            <p className="text-base text-stone-700 leading-relaxed whitespace-pre-wrap">{entry.content}</p>

            {/* Photos */}
            {entry.photos?.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {entry.photos.map((url, i) => (
                  <EncryptedImage key={i} src={url} alt="" className="rounded-xl object-cover w-full aspect-square" />
                ))}
              </div>
            )}

            {/* Videos */}
            {entry.videos?.length > 0 && (
              <div className="space-y-3">
                {entry.videos.map((v, i) => (
                  <div key={i}>
                    <EncryptedVideo
                      src={v.url}
                      controls
                      playsInline
                      className="w-full rounded-xl bg-black max-h-56"
                    />
                    {v.title && <p className="text-xs text-stone-500 mt-1">{v.title}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Voice memos */}
            {entry.voiceMemos?.length > 0 && (
              <div className="space-y-2">
                {entry.voiceMemos.map((memo, i) => (
                  <div key={i} className="bg-stone-100 rounded-xl px-3 py-2">
                    <p className="text-xs text-stone-500 mb-1.5">
                      🎙 {memo.title || `Voice note ${i + 1}`}
                    </p>
                    <EncryptedAudio src={memo.url} controls className="w-full h-8" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

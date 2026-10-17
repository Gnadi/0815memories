import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Mic, Pencil, Trash2 } from 'lucide-react'
import { EMOTIONS } from '../constants/emotions'
import { useAuth } from '../context/AuthContext'
import { useKids } from '../hooks/useKids'
import { useJournals } from '../hooks/useJournals'
import EncryptedImage from '../components/media/EncryptedImage'
import EncryptedVideo from '../components/media/EncryptedVideo'
import EncryptedAudio from '../components/media/EncryptedAudio'
import JournalContent from '../components/journal/JournalContent'
import { entryDate } from '../utils/journalContent'

const HEADER_BUTTON = 'w-11 h-11 rounded-full flex items-center justify-center transition-colors flex-shrink-0'

/** One entry, set like a letter: a column of readable width on the app's paper. */
export default function JournalDetailPage() {
  const { t, i18n } = useTranslation('journal')
  const { childId, entryId } = useParams()
  const { isAdmin, familyId, encryptionKey } = useAuth()
  const navigate = useNavigate()
  const { kids } = useKids(familyId, encryptionKey)
  const { journals, loading, deleteJournal } = useJournals(familyId, childId, encryptionKey)

  const kid = kids.find((k) => k.id === childId)
  const entry = journals.find((j) => j.id === entryId)

  useEffect(() => {
    if (!isAdmin) navigate('/home')
  }, [isAdmin, navigate])

  if (!isAdmin) return null

  const emotion = EMOTIONS.find((e) => e.key === entry?.emotion) || EMOTIONS[1]
  const date = entryDate(entry)
  const formattedDate = date?.toLocaleDateString(i18n.language, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const handleDelete = async () => {
    if (!confirm(t('detail.deleteLetterConfirm'))) return
    await deleteJournal(entryId)
    navigate(`/journal/${childId}`, { replace: true })
  }

  return (
    <div className="min-h-[100dvh] bg-cream">
      <header className="sticky top-0 z-20 bg-cream/95 backdrop-blur border-b border-cream-dark pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto flex items-center gap-2 px-2 sm:px-4 py-2">
          <button
            type="button"
            onClick={() => navigate(`/journal/${childId}`)}
            aria-label={t('detail.back')}
            className={`${HEADER_BUTTON} text-bark-muted hover:text-bark hover:bg-cream-dark`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <p className="flex-1 min-w-0 font-semibold text-bark truncate">
            {kid?.name ? t('detail.toName', { name: kid.name }) : t('archive.fallbackTitle')}
          </p>
          {entry && (
            <>
              <button
                type="button"
                onClick={() => navigate(`/journal/${childId}/edit/${entryId}`)}
                aria-label={t('common:buttons.edit')}
                title={t('common:buttons.edit')}
                className={`${HEADER_BUTTON} text-bark-muted hover:text-bark hover:bg-cream-dark`}
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                aria-label={t('common:buttons.delete')}
                title={t('common:buttons.delete')}
                className={`${HEADER_BUTTON} text-bark-muted hover:text-red-600 hover:bg-red-50`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </header>

      {!entry ? (
        loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 border-2 border-kaydo border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <p className="text-center text-bark-muted py-24 px-4">{t('detail.notFound')}</p>
        )
      ) : (
        <article className="max-w-2xl mx-auto px-5 sm:px-8 pt-6 sm:pt-10 pb-[calc(env(safe-area-inset-bottom)+3rem)]">
          <div className="flex items-center flex-wrap gap-x-3 gap-y-2 mb-4">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${emotion.bg} ${emotion.text}`}>
              <span aria-hidden="true">{emotion.emoji}</span> {t('emotions:' + emotion.key)}
            </span>
            {formattedDate && (
              <time dateTime={date.toISOString()} className="text-sm text-bark-muted">{formattedDate}</time>
            )}
          </div>

          {entry.volume && (
            <p className="text-xs font-semibold text-kaydo uppercase tracking-widest mb-2">{entry.volume}</p>
          )}
          {entry.title && (
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-bark leading-tight mb-6">{entry.title}</h1>
          )}

          <div className="text-[1.0625rem] sm:text-lg text-bark-light">
            <JournalContent entry={entry} />
          </div>

          {entry.photos?.length > 0 && (
            <div className={`mt-8 grid gap-2 ${entry.photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {entry.photos.map((url, i) => (
                <EncryptedImage
                  key={i}
                  src={url}
                  alt=""
                  className={`rounded-2xl object-cover w-full ${entry.photos.length === 1 ? 'max-h-[70vh]' : 'aspect-square'}`}
                />
              ))}
            </div>
          )}

          {entry.videos?.length > 0 && (
            <div className="mt-6 space-y-4">
              {entry.videos.map((v, i) => (
                <figure key={i}>
                  <EncryptedVideo src={v.url} controls playsInline className="w-full rounded-2xl bg-black max-h-[70vh]" />
                  {v.title && <figcaption className="text-sm text-bark-muted mt-1.5">{v.title}</figcaption>}
                </figure>
              ))}
            </div>
          )}

          {entry.voiceMemos?.length > 0 && (
            <div className="mt-6 space-y-2">
              {entry.voiceMemos.map((memo, i) => (
                <div key={i} className="bg-warm-white border border-cream-dark rounded-2xl px-4 py-3">
                  <p className="flex items-center gap-2 text-sm text-bark mb-2">
                    <Mic className="w-4 h-4 text-kaydo" />
                    {memo.title || t('detail.voiceNote', { index: i + 1 })}
                  </p>
                  <EncryptedAudio src={memo.url} controls className="w-full h-10" />
                </div>
              ))}
            </div>
          )}
        </article>
      )}
    </div>
  )
}

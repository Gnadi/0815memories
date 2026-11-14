import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, PenLine, Sparkles, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useKids } from '../hooks/useKids'
import { useJournals } from '../hooks/useJournals'
import JournalEntryCard from '../components/journal/JournalEntryCard'
import EncryptedImage from '../components/media/EncryptedImage'
import Sidebar from '../components/layout/Sidebar'
import { entryDate } from '../utils/journalContent'

/** Entries newest first, as they come, in one group per year. */
function byYear(entries) {
  const groups = []
  for (const entry of entries) {
    const year = entryDate(entry)?.getFullYear() ?? null
    const last = groups[groups.length - 1]
    if (last && last.year === year) last.entries.push(entry)
    else groups.push({ year, entries: [entry] })
  }
  return groups
}

export default function JournalArchivePage() {
  const { t } = useTranslation('journal')
  const { isAdmin, familyId, encryptionKey } = useAuth()
  const navigate = useNavigate()
  const { childId } = useParams()
  const { kids } = useKids(familyId, encryptionKey)
  const { journals, loading } = useJournals(familyId, childId, encryptionKey)
  const groups = useMemo(() => byYear(journals), [journals])

  useEffect(() => {
    if (!isAdmin) navigate('/home')
  }, [isAdmin, navigate])

  const kid = kids.find((k) => k.id === childId)

  if (!isAdmin) return null

  const birthdate = kid?.birthdate?.toDate ? kid.birthdate.toDate() : kid?.birthdate ? new Date(kid.birthdate) : null
  const age = birthdate ? Math.floor((new Date() - birthdate) / (365.25 * 24 * 60 * 60 * 1000)) : null
  const write = () => navigate(`/journal/${childId}/new`)

  return (
    <div className="min-h-screen bg-cream flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-40 sm:pb-24 lg:pb-0">
        <div className="sticky top-0 z-20 bg-cream/95 backdrop-blur border-b border-cream-dark">
          <div className="max-w-2xl mx-auto px-2 sm:px-4 py-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/journal')}
              aria-label={t('archive.back')}
              className="w-11 h-11 rounded-full flex items-center justify-center text-bark-muted hover:text-bark hover:bg-cream-dark transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="flex-1 min-w-0 font-semibold text-bark truncate">{kid?.name || t('archive.fallbackTitle')}</h1>
            <button
              type="button"
              onClick={() => navigate(`/journal/${childId}/sky`)}
              aria-label={t('archive.skyOfBirth')}
              title={t('archive.skyOfBirth')}
              className="min-w-11 h-11 rounded-full flex items-center justify-center gap-1.5 px-2 text-sm text-bark-muted hover:text-bark hover:bg-cream-dark transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">{t('archive.skyOfBirth')}</span>
            </button>
            <button
              type="button"
              onClick={write}
              className="btn-kaydo hidden sm:flex items-center gap-1.5 text-sm py-2 px-3"
            >
              <PenLine className="w-4 h-4" />
              {t('archive.write')}
            </button>
          </div>
        </div>

        <div className="px-4 py-6 md:py-8 max-w-2xl mx-auto w-full">
          {/* Who the letters are for */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-cream-dark flex-shrink-0 flex items-center justify-center ring-4 ring-warm-white shadow-sm">
              {kid?.profilePhoto ? (
                <EncryptedImage src={kid.profilePhoto} alt={kid?.name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-7 h-7 text-bark-muted" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-serif text-2xl font-bold text-bark truncate">{t('archive.heading', { name: kid?.name || t('archive.empty.bodyFallback') })}</p>
              <p className="text-sm text-bark-muted">
                {age !== null && <>{t('archive.yearsOld', { age })} · </>}
                {t('archive.entries', { count: journals.length })}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-kaydo border-t-transparent rounded-full animate-spin" />
            </div>
          ) : journals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center bg-warm-white rounded-2xl border border-dashed border-cream-darker px-6">
              <p className="font-semibold text-bark">{t('archive.empty.heading')}</p>
              <p className="text-sm text-bark-muted">
                {t('archive.empty.bodyNamed', { name: kid?.name || t('archive.empty.bodyFallback') })}
              </p>
              <button type="button" onClick={write} className="btn-kaydo flex items-center gap-2">
                <PenLine className="w-4 h-4" />
                {t('archive.empty.writeFirst')}
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {groups.map((group) => (
                <section key={group.year ?? 'undated'} aria-label={group.year ? String(group.year) : undefined}>
                  {group.year && (
                    <h2 className="flex items-center gap-3 mb-3 text-sm font-semibold text-bark-muted tracking-widest">
                      {group.year}
                      <span className="flex-1 h-px bg-cream-dark" aria-hidden="true" />
                    </h2>
                  )}
                  <ul className="space-y-3">
                    {group.entries.map((entry) => (
                      <li key={entry.id}>
                        <JournalEntryCard
                          entry={entry}
                          onView={() => navigate(`/journal/${childId}/view/${entry.id}`)}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* On a phone the write button sits where the thumb is, above the
            bottom navigation, instead of in the crowded header. */}
        {journals.length > 0 && (
          <button
            type="button"
            onClick={write}
            aria-label={t('archive.write')}
            className="sm:hidden fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-30 btn-kaydo flex items-center gap-2 rounded-full shadow-lg px-5 min-h-12"
          >
            <PenLine className="w-5 h-5" />
            {t('archive.write')}
          </button>
        )}
      </div>
    </div>
  )
}

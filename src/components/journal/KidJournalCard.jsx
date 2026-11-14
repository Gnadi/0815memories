import { useTranslation } from 'react-i18next'
import { User, BookOpen, Sparkles, ChevronRight, Pencil, PenLine, Trash2 } from 'lucide-react'
import EncryptedImage from '../media/EncryptedImage'

const ICON_BUTTON = 'w-11 h-11 rounded-full flex items-center justify-center transition-colors'

export default function KidJournalCard({ kid, journalCount, lastEntryDate, onViewArchive, onViewSky, onEdit, onDelete }) {
  const { t, i18n } = useTranslation('journal')
  const birthdate = kid.birthdate?.toDate ? kid.birthdate.toDate() : new Date(kid.birthdate)
  const validBirth = !Number.isNaN(birthdate.getTime())
  const age = validBirth ? Math.floor((new Date() - birthdate) / (365.25 * 24 * 60 * 60 * 1000)) : -1
  const formattedBirth = validBirth
    ? birthdate.toLocaleDateString(i18n.language, { month: 'long', day: 'numeric', year: 'numeric' })
    : ''
  const formattedLast = lastEntryDate?.toLocaleDateString(i18n.language, { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div className="bg-warm-white rounded-2xl shadow-sm border border-cream-dark flex flex-col overflow-hidden">
      <button
        type="button"
        onClick={onViewArchive}
        className="flex items-center gap-4 p-4 text-left hover:bg-cream/60 transition-colors"
      >
        <div className="w-16 h-16 rounded-full overflow-hidden bg-cream-dark flex-shrink-0 flex items-center justify-center">
          {kid.profilePhoto ? (
            <EncryptedImage src={kid.profilePhoto} alt="" className="w-full h-full object-cover" />
          ) : (
            <User className="w-8 h-8 text-bark-muted" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-xl font-bold text-bark truncate">{kid.name}</h3>
          {formattedBirth && (
            <p className="text-sm text-bark-muted">
              {t('card.born', { date: formattedBirth })}
              {age >= 0 && (age === 1 ? t('card.ageSuffixOne', { age }) : t('card.ageSuffixOther', { age }))}
            </p>
          )}
        </div>
        <ChevronRight className="w-5 h-5 text-bark-muted flex-shrink-0" aria-hidden="true" />
      </button>

      <div className="px-4 pb-3">
        {journalCount > 0 ? (
          <p className="flex items-center gap-2 px-3 py-2 bg-cream rounded-xl text-sm text-bark">
            <BookOpen className="w-4 h-4 text-kaydo flex-shrink-0" />
            <span className="min-w-0">
              {t('card.entries', { count: journalCount })}
              {formattedLast && <span className="text-bark-muted"> · {t('card.lastEntry', { date: formattedLast })}</span>}
            </span>
          </p>
        ) : (
          <p className="text-sm text-bark-muted italic px-1">{t('card.noLettersYet')}</p>
        )}
      </div>

      <div className="mt-auto flex items-center gap-1 border-t border-cream-dark px-2 py-1">
        <button
          type="button"
          onClick={onViewArchive}
          className="flex items-center gap-1.5 min-h-11 px-3 rounded-full text-sm font-semibold text-kaydo hover:bg-cream transition-colors"
        >
          {journalCount > 0 ? (
            <><BookOpen className="w-4 h-4" /> {t('card.viewArchive')}</>
          ) : (
            <><PenLine className="w-4 h-4" /> {t('card.startJournal')}</>
          )}
        </button>
        <span className="flex-1" />
        {onViewSky && (
          <button
            type="button"
            onClick={onViewSky}
            aria-label={t('card.skyOfBirth')}
            title={t('card.skyOfBirth')}
            className={`${ICON_BUTTON} text-bark-muted hover:text-bark hover:bg-cream`}
          >
            <Sparkles className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          aria-label={t('card.editChild', { name: kid.name })}
          title={t('common:buttons.edit')}
          className={`${ICON_BUTTON} text-bark-muted hover:text-bark hover:bg-cream`}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={t('card.deleteChild', { name: kid.name })}
          title={t('common:buttons.delete')}
          className={`${ICON_BUTTON} text-bark-muted hover:text-red-600 hover:bg-red-50`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Check, Loader2, Music, Quote, Sparkles } from 'lucide-react'
import EncryptedImage from '../media/EncryptedImage'
import { canCloseChapter, formatDay, formatPeriod, letterState } from '../../utils/ourYear'

/**
 * The last look before a chapter becomes part of the timeline. Once it is
 * closed it stays as it is — so this shows the whole of it one more time.
 */
export default function ChapterSummary({ chapter, onClose }) {
  const { t, i18n } = useTranslation('ourYear')
  const locale = i18n.language || 'de'
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState('')

  const { ready, missing } = canCloseChapter(chapter)
  const keepsakes = chapter.keepsakes ?? {}
  const closed = chapter.status === 'closed'
  const letter = letterState(chapter)

  const handleClose = async () => {
    setError('')
    if (!window.confirm(t('summary.closeConfirm'))) return
    setClosing(true)
    try {
      await onClose()
    } catch {
      setError(t('errors.saveFailed'))
      setClosing(false)
    }
  }

  return (
    <section className="bg-warm-white rounded-2xl shadow-sm p-5 md:p-6">
      <h2 className="font-serif text-xl font-bold text-bark leading-snug">
        {closed ? t('summary.closedHeading') : t('summary.title')}
      </h2>
      <p className="text-sm text-bark-muted mt-1 max-w-xl">
        {closed
          ? t('summary.closedBody', { date: formatDay(chapter.closedAt, locale) })
          : t('summary.intro')}
      </p>

      <div className="mt-5 bg-cream rounded-2xl p-4">
        <p className="font-serif text-lg font-bold text-bark leading-snug">{chapter.title}</p>
        <p className="text-sm text-bark-muted">
          {formatPeriod(chapter.periodStart, chapter.periodEnd, locale)}
        </p>

        {keepsakes.photoUrl && (
          <EncryptedImage
            src={keepsakes.photoUrl}
            alt=""
            className="w-full h-40 object-cover rounded-xl mt-3"
          />
        )}

        <div className="mt-3 space-y-2">
          {keepsakes.song?.title && (
            <p className="flex items-center gap-2 text-sm text-bark-light">
              <Music className="w-4 h-4 text-bark-muted flex-shrink-0" />
              <span className="truncate">
                {keepsakes.song.title}
                {keepsakes.song.artist ? ` · ${keepsakes.song.artist}` : ''}
              </span>
            </p>
          )}
          {keepsakes.quote && (
            <p className="flex items-start gap-2 text-sm text-bark font-serif italic">
              <Quote className="w-4 h-4 text-bark-muted flex-shrink-0 mt-0.5" />
              <span>{keepsakes.quote}</span>
            </p>
          )}
          {keepsakes.moment && (
            <p className="flex items-start gap-2 text-sm text-bark-muted">
              <Sparkles className="w-4 h-4 text-bark-muted flex-shrink-0 mt-0.5" />
              <span className="whitespace-pre-wrap break-words">{keepsakes.moment}</span>
            </p>
          )}
        </div>

        {letter === 'sealed' && (
          <p className="text-xs text-bark-muted mt-3 pt-3 border-t border-cream-dark">
            {t('summary.letterPending', { date: formatDay(chapter.letterOpenAt, locale) })}
          </p>
        )}
      </div>

      {closed ? null : ready ? (
        <div className="mt-5">
          <div className="flex items-start gap-3 bg-kaydo/10 rounded-2xl p-4">
            <Check className="w-5 h-5 text-kaydo flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-bark text-sm">{t('summary.readyHeading')}</p>
              <p className="text-sm text-bark-muted mt-0.5">{t('summary.readyBody')}</p>
            </div>
          </div>
          {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
          <button
            type="button"
            onClick={handleClose}
            disabled={closing}
            className="btn-kaydo w-full mt-4 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {closing && <Loader2 className="w-4 h-4 animate-spin" />}
            {closing ? t('summary.closing') : t('summary.close')}
          </button>
        </div>
      ) : (
        <div className="mt-5 flex items-start gap-3 bg-cream rounded-2xl p-4">
          <AlertCircle className="w-5 h-5 text-bark-muted flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-bark text-sm">{t('summary.missingHeading')}</p>
            <ul className="mt-1.5 space-y-1">
              {missing.map((part) => (
                <li key={part} className="text-sm text-bark-muted">
                  {t(`summary.missing.${part}`)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  )
}

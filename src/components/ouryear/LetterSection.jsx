import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, Lock, Mail, MailOpen } from 'lucide-react'
import { useOurYearLetter } from '../../hooks/useOurYear'
import { formatDay, letterState, suggestLetterOpenDate } from '../../utils/ourYear'

const LETTER_SECTIONS = ['now', 'wishes', 'remember']

const toInputValue = (date) => {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const fromInputValue = (value) => {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * The letter the couple writes together and then closes.
 *
 * The lock is real: while the letter is sealed and the chosen day has not
 * arrived, Firestore refuses to hand out the document at all. This component
 * doesn't even subscribe to it — everything the waiting state needs (status and
 * open date) sits on the chapter.
 */
export default function LetterSection({ chapter, ritual, encryptionKey, readOnly }) {
  const { t, i18n } = useTranslation('ourYear')
  const locale = i18n.language || 'de'
  const { letter, locked, saveDraft, seal, open } = useOurYearLetter(chapter, encryptionKey)

  // Null until someone types, so a draft the other partner saved shows up as
  // soon as it loads instead of being overwritten by an empty form.
  const [draft, setDraft] = useState(null)
  const [openAt, setOpenAt] = useState(() => toInputValue(suggestLetterOpenDate(ritual)))
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  const state = letterState(chapter)
  const sections = draft ?? letter?.sections ?? {}
  const editSection = (id, value) => {
    setDraft((prev) => ({ ...(prev ?? letter?.sections ?? {}), [id]: value }))
    setStatus('idle')
  }

  const handleSave = async () => {
    setError('')
    setStatus('saving')
    try {
      await saveDraft(sections)
      setStatus('saved')
    } catch {
      setError(t('errors.saveFailed'))
      setStatus('idle')
    }
  }

  const handleSeal = async () => {
    setError('')
    if (!LETTER_SECTIONS.some((id) => sections[id]?.trim())) {
      setError(t('letter.needText'))
      return
    }
    const date = fromInputValue(openAt)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (!(date > today)) {
      setError(t('letter.needFutureDate'))
      return
    }
    if (!window.confirm(t('letter.sealConfirm', { date: formatDay(date, locale) }))) return

    setStatus('sealing')
    try {
      await seal(sections, date)
      setStatus('idle')
    } catch {
      setError(t('errors.saveFailed'))
      setStatus('idle')
    }
  }

  const handleOpen = async () => {
    setError('')
    setStatus('opening')
    try {
      await open()
      setStatus('idle')
    } catch {
      setError(t('errors.saveFailed'))
      setStatus('idle')
    }
  }

  // --- Sealed, the day is still ahead ---------------------------------------
  if (locked) {
    return (
      <section className="bg-bark text-white rounded-2xl shadow-sm p-5 md:p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-bold leading-snug">{t('letter.sealedHeading')}</h2>
            <p className="text-sm text-white/70 mt-0.5">
              {t('letter.sealedBody', { date: formatDay(chapter.letterOpenAt, locale) })}
            </p>
          </div>
        </div>
        <p className="text-sm text-white/60 mt-4">{t('letter.sealedNote')}</p>
      </section>
    )
  }

  // --- Ready to be opened ---------------------------------------------------
  if (state === 'waiting') {
    return (
      <section className="bg-warm-white rounded-2xl shadow-sm p-5 md:p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-kaydo/10 flex items-center justify-center mx-auto mb-4">
          <Mail className="w-6 h-6 text-kaydo" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-bark leading-snug">
          {t('letter.waitingHeading')}
        </h2>
        <p className="text-sm text-bark-muted mt-2 max-w-md mx-auto">
          {t('letter.waitingBody', { date: formatDay(letter?.sealedAt, locale) })}
        </p>
        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
        <button
          type="button"
          onClick={handleOpen}
          disabled={status === 'opening'}
          className="btn-kaydo mt-5 inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {status === 'opening' && <Loader2 className="w-4 h-4 animate-spin" />}
          {status === 'opening' ? t('letter.opening') : t('letter.openCta')}
        </button>
      </section>
    )
  }

  // --- Opened, and it stays with the chapter --------------------------------
  if (state === 'opened') {
    return (
      <section className="bg-warm-white rounded-2xl shadow-sm p-5 md:p-6">
        <div className="flex items-center gap-3 mb-1">
          <MailOpen className="w-5 h-5 text-kaydo flex-shrink-0" />
          <h2 className="font-serif text-xl font-bold text-bark leading-snug">
            {t('letter.openedHeading')}
          </h2>
        </div>
        <p className="text-sm text-bark-muted mb-5">
          {t('letter.writtenOn', { date: formatDay(letter?.sealedAt, locale) })}
          {chapter.letterOpenedAt
            ? ` · ${t('letter.openedOn', { date: formatDay(chapter.letterOpenedAt, locale) })}`
            : ''}
        </p>

        <div className="space-y-5">
          {LETTER_SECTIONS.map((id) => (
            <div key={id} className="bg-cream rounded-2xl p-4">
              <p className="font-serif text-base font-semibold text-bark leading-snug">
                {t(`letter.questions.${id}`)}
              </p>
              <p className="text-sm text-bark mt-2 whitespace-pre-wrap break-words">
                {letter?.sections?.[id]?.trim() || (
                  <span className="text-bark-muted italic">{t('letter.emptySection')}</span>
                )}
              </p>
            </div>
          ))}
        </div>
      </section>
    )
  }

  // --- Nothing written yet, and the chapter is already closed ---------------
  if (readOnly) {
    return (
      <section className="bg-warm-white rounded-2xl shadow-sm p-5 md:p-6">
        <h2 className="font-serif text-xl font-bold text-bark leading-snug">{t('letter.title')}</h2>
        <p className="text-sm text-bark-muted mt-2">{t('letter.emptySection')}</p>
      </section>
    )
  }

  // --- Writing together -----------------------------------------------------
  return (
    <section className="bg-warm-white rounded-2xl shadow-sm p-5 md:p-6">
      <h2 className="font-serif text-xl font-bold text-bark leading-snug">{t('letter.title')}</h2>
      <p className="text-sm text-bark-muted mt-1 mb-5 max-w-xl">{t('letter.intro')}</p>

      <div className="space-y-4">
        {LETTER_SECTIONS.map((id) => (
          <div key={id}>
            <label
              htmlFor={`letter-${id}`}
              className="block font-serif text-base font-semibold text-bark leading-snug mb-2"
            >
              {t(`letter.questions.${id}`)}
            </label>
            <textarea
              id={`letter-${id}`}
              rows={3}
              value={sections[id] ?? ''}
              onChange={(e) => editSection(id, e.target.value)}
              placeholder={t('letter.placeholder')}
              className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30 resize-none"
            />
          </div>
        ))}
      </div>

      <div className="mt-5 pt-5 border-t border-cream-dark">
        <label htmlFor="letter-open-at" className="block text-sm font-medium text-bark mb-1">
          {t('letter.openAtLabel')}
        </label>
        <input
          id="letter-open-at"
          type="date"
          value={openAt}
          onChange={(e) => setOpenAt(e.target.value)}
          className="w-full sm:w-64 px-4 py-2.5 bg-cream-dark rounded-xl text-bark outline-none focus:ring-2 focus:ring-kaydo/30"
        />
        <p className="text-xs text-bark-muted mt-1.5">{t('letter.openAtHint')}</p>
      </div>

      {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

      <div className="flex flex-col sm:flex-row gap-2 mt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={status === 'saving' || status === 'sealing'}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border border-cream-dark text-bark hover:bg-cream-dark transition-colors disabled:opacity-50"
        >
          {status === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
          {status === 'saved' && <Check className="w-4 h-4" />}
          {status === 'saved' ? t('letter.saved') : t('letter.save')}
        </button>
        <button
          type="button"
          onClick={handleSeal}
          disabled={status === 'sealing'}
          className="flex-1 flex items-center justify-center gap-2 bg-bark text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-bark/90 transition-colors disabled:opacity-50"
        >
          {status === 'sealing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
          {status === 'sealing' ? t('letter.sealing') : t('letter.seal')}
        </button>
      </div>
    </section>
  )
}

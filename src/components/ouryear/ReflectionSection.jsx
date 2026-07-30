import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, Lock } from 'lucide-react'
import { useOurYearEntries } from '../../hooks/useOurYear'
import {
  REFLECTION_QUESTION_IDS,
  participantName,
  partnerUidOf,
  periodKind,
} from '../../utils/ourYear'
import AnswerComparison from './AnswerComparison'

/**
 * The five questions both partners answer independently.
 *
 * Until both have handed in, nobody sees the other side — and that is enforced
 * by the security rules, not just by this component: the partner's document is
 * simply not readable yet.
 */
export default function ReflectionSection({ chapter, ritual, uid, encryptionKey, readOnly }) {
  const { t } = useTranslation('ourYear')
  const { own, partner, revealed, saveDraft, submit } = useOurYearEntries(
    chapter,
    'reflection',
    uid,
    encryptionKey,
  )

  // `draft` is null until this person types — until then the stored answers are
  // shown directly, so a draft written on another device shows up as it loads.
  const [draft, setDraft] = useState(null)
  const [status, setStatus] = useState('idle') // idle | saving | saved | submitting
  const [error, setError] = useState('')

  const answers = draft ?? own?.answers ?? {}
  const editAnswer = (id, value) => {
    setDraft((prev) => ({ ...(prev ?? own?.answers ?? {}), [id]: value }))
    setStatus('idle')
  }

  const partnerUid = partnerUidOf(chapter, uid)
  const ownName = participantName(ritual, uid) || t('partner.you')
  const partnerLabel = participantName(ritual, partnerUid) || t('partner.genericShort')

  const period = t(`periodPhrase.${periodKind(chapter.periodStart, chapter.periodEnd)}`)
  const questions = useMemo(
    () =>
      REFLECTION_QUESTION_IDS.map((id) => ({
        id,
        label: t(`reflection.questions.${id}`, { period }),
      })),
    [t, period],
  )

  const submitted = !!own?.submitted
  const partnerSubmitted = (chapter.reflectionSubmittedBy ?? []).includes(partnerUid)

  const handleSave = async () => {
    setError('')
    setStatus('saving')
    try {
      await saveDraft(answers)
      setStatus('saved')
    } catch {
      setError(t('errors.saveFailed'))
      setStatus('idle')
    }
  }

  const handleSubmit = async () => {
    setError('')
    if (!REFLECTION_QUESTION_IDS.some((id) => answers[id]?.trim())) {
      setError(t('reflection.needAnswer'))
      return
    }
    if (!window.confirm(t('reflection.submitConfirm'))) return
    setStatus('submitting')
    try {
      await submit(answers)
      setStatus('idle')
    } catch {
      setError(t('errors.saveFailed'))
      setStatus('idle')
    }
  }

  // --- Both are in: look at it together -------------------------------------
  if (revealed) {
    return (
      <Shell title={t('reflection.title')}>
        <div className="mb-5">
          <p className="font-semibold text-bark">{t('reflection.revealedHeading')}</p>
          <p className="text-sm text-bark-muted mt-0.5 max-w-xl">{t('reflection.revealedHint')}</p>
        </div>
        <AnswerComparison
          questions={questions}
          own={own?.answers}
          partner={partner?.answers}
          ownName={ownName}
          partnerName={partnerLabel}
        />
      </Shell>
    )
  }

  // --- You handed in, your partner hasn't -----------------------------------
  if (submitted) {
    return (
      <Shell title={t('reflection.title')}>
        <div className="bg-cream rounded-2xl p-5 text-center">
          <div className="w-12 h-12 rounded-full bg-bark/10 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-5 h-5 text-bark-muted" />
          </div>
          <p className="font-semibold text-bark">{t('reflection.waitingHeading')}</p>
          <p className="text-sm text-bark-muted mt-1">
            {t('reflection.waitingBody', { name: partnerLabel })}
          </p>
        </div>

        <div className="mt-5 space-y-4">
          {questions.map((question) => (
            <div key={question.id} className="bg-cream rounded-2xl p-4">
              <p className="font-serif text-base font-semibold text-bark leading-snug">
                {question.label}
              </p>
              <p className="text-sm text-bark mt-2 whitespace-pre-wrap break-words">
                {own?.answers?.[question.id]?.trim() || (
                  <span className="text-bark-muted italic">{t('reflection.noAnswer')}</span>
                )}
              </p>
            </div>
          ))}
        </div>
      </Shell>
    )
  }

  // --- A closed chapter nobody finished — show what is there, read-only ------
  if (readOnly) {
    return (
      <Shell title={t('reflection.title')}>
        <p className="text-sm text-bark-muted">{t('reflection.noAnswer')}</p>
      </Shell>
    )
  }

  // --- Your turn ------------------------------------------------------------
  return (
    <Shell title={t('reflection.title')} intro={t('reflection.intro')}>
      {partnerSubmitted && (
        <div className="bg-kaydo/10 rounded-2xl p-4 mb-5">
          <p className="font-semibold text-bark text-sm">
            {t('reflection.partnerDoneHeading', { name: partnerLabel })}
          </p>
          <p className="text-sm text-bark-muted mt-0.5">
            {t('reflection.partnerDoneBody', { name: partnerLabel })}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {questions.map((question) => (
          <div key={question.id}>
            <label
              htmlFor={`reflection-${question.id}`}
              className="block font-serif text-base font-semibold text-bark leading-snug mb-2"
            >
              {question.label}
            </label>
            <textarea
              id={`reflection-${question.id}`}
              rows={3}
              value={answers[question.id] ?? ''}
              onChange={(e) => editAnswer(question.id, e.target.value)}
              placeholder={t('reflection.placeholder')}
              className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30 resize-none"
            />
          </div>
        ))}
      </div>

      <p className="text-xs text-bark-muted mt-4">{t('reflection.submitHint')}</p>
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

      <div className="flex flex-col sm:flex-row gap-2 mt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={status === 'saving' || status === 'submitting'}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border border-cream-dark text-bark hover:bg-cream-dark transition-colors disabled:opacity-50"
        >
          {status === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
          {status === 'saved' && <Check className="w-4 h-4" />}
          {status === 'saved' ? t('reflection.saved') : t('reflection.save')}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={status === 'submitting'}
          className="flex-1 flex items-center justify-center gap-2 bg-bark text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-bark/90 transition-colors disabled:opacity-50"
        >
          {status === 'submitting' && <Loader2 className="w-4 h-4 animate-spin" />}
          {status === 'submitting' ? t('reflection.submitting') : t('reflection.submit')}
        </button>
      </div>
    </Shell>
  )
}

function Shell({ title, intro, children }) {
  return (
    <section className="bg-warm-white rounded-2xl shadow-sm p-5 md:p-6">
      <h2 className="font-serif text-xl font-bold text-bark leading-snug">{title}</h2>
      {intro && <p className="text-sm text-bark-muted mt-1 mb-5 max-w-xl">{intro}</p>}
      {!intro && <div className="mb-5" />}
      {children}
    </section>
  )
}

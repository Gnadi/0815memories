import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, Lock, Pencil } from 'lucide-react'
import { useOurYearEntries } from '../../hooks/useOurYear'
import {
  QUIZ_REACTIONS,
  participantName,
  partnerUidOf,
  periodKind,
} from '../../utils/ourYear'
import AnswerComparison from './AnswerComparison'
import QuizQuestionEditor from './QuizQuestionEditor'

/**
 * The couple's own quiz. Same blind-then-compare mechanic as the review, but
 * lighter in tone: no points, no winner, and a chapter's questions are meant to
 * be rewritten every time.
 */
export default function QuizSection({ chapter, ritual, uid, encryptionKey, readOnly, onUpdateChapter }) {
  const { t } = useTranslation('ourYear')
  const { own, partner, revealed, saveDraft, submit } = useOurYearEntries(
    chapter,
    'quiz',
    uid,
    encryptionKey,
  )

  // Null until this person types — see ReflectionSection for the same pattern.
  const [draft, setDraft] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)

  const answers = draft ?? own?.answers ?? {}
  const editAnswer = (id, value) => {
    setDraft((prev) => ({ ...(prev ?? own?.answers ?? {}), [id]: value }))
    setStatus('idle')
  }

  const partnerUid = partnerUidOf(chapter, uid)
  const ownName = participantName(ritual, uid) || t('partner.you')
  const partnerLabel = participantName(ritual, partnerUid) || t('partner.genericShort')

  const period = t(`periodPhrase.${periodKind(chapter.periodStart, chapter.periodEnd)}`)
  const storedQuestions = chapter.quizQuestions
  const chapterQuestions = useMemo(() => storedQuestions ?? [], [storedQuestions])

  const questions = useMemo(
    () =>
      chapterQuestions.map((question) => ({
        id: question.id,
        label: question.presetKey
          ? t(`quiz.questions.${question.presetKey}`, { period })
          : question.text,
      })),
    [chapterQuestions, t, period],
  )

  const submitted = !!own?.submitted
  const partnerSubmitted = (chapter.quizSubmittedBy ?? []).includes(partnerUid)
  // Once anyone has handed in, the questions are fixed — otherwise the two
  // would end up answering different things.
  const canEditQuestions = !readOnly && (chapter.quizSubmittedBy ?? []).length === 0

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
    if (!questions.some((q) => answers[q.id]?.trim())) {
      setError(t('quiz.needAnswer'))
      return
    }
    if (!window.confirm(t('quiz.submitConfirm'))) return
    setStatus('submitting')
    try {
      await submit(answers)
      setStatus('idle')
    } catch {
      setError(t('errors.saveFailed'))
      setStatus('idle')
    }
  }

  const setReaction = async (questionId, reaction) => {
    const current = chapter.quizReactions ?? {}
    const next = { ...current }
    if (next[questionId] === reaction) delete next[questionId]
    else next[questionId] = reaction
    try {
      await onUpdateChapter({ quizReactions: next })
    } catch {
      setError(t('errors.saveFailed'))
    }
  }

  // --- Compared ------------------------------------------------------------
  if (revealed) {
    return (
      <Shell title={t('quiz.title')}>
        <div className="mb-5">
          <p className="font-semibold text-bark">{t('quiz.revealedHeading')}</p>
          <p className="text-sm text-bark-muted mt-0.5 max-w-xl">{t('quiz.revealedHint')}</p>
        </div>
        <AnswerComparison
          questions={questions}
          own={own?.answers}
          partner={partner?.answers}
          ownName={ownName}
          partnerName={partnerLabel}
        >
          {(question) => (
            <div className="mt-3 pt-3 border-t border-cream-dark">
              <p className="text-xs font-medium text-bark-muted mb-2">{t('quiz.reactionLabel')}</p>
              <div className="flex flex-wrap gap-2">
                {QUIZ_REACTIONS.map((reaction) => {
                  const active = (chapter.quizReactions ?? {})[question.id] === reaction
                  return (
                    <button
                      key={reaction}
                      type="button"
                      disabled={readOnly}
                      onClick={() => setReaction(question.id, reaction)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors disabled:opacity-100 disabled:cursor-default ${
                        active
                          ? 'bg-kaydo text-white'
                          : 'bg-cream-dark text-bark-muted hover:text-bark disabled:hover:text-bark-muted'
                      }`}
                    >
                      {t(`quiz.reactions.${reaction}`)}
                    </button>
                  )
                })}
              </div>
              {!readOnly && <p className="text-xs text-bark-muted mt-2">{t('quiz.reactionHint')}</p>}
            </div>
          )}
        </AnswerComparison>
        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
      </Shell>
    )
  }

  // --- Waiting for the other side ------------------------------------------
  if (submitted) {
    return (
      <Shell title={t('quiz.title')}>
        <div className="bg-cream rounded-2xl p-5 text-center">
          <div className="w-12 h-12 rounded-full bg-bark/10 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-5 h-5 text-bark-muted" />
          </div>
          <p className="font-semibold text-bark">{t('quiz.waitingHeading')}</p>
          <p className="text-sm text-bark-muted mt-1">
            {t('quiz.waitingBody', { name: partnerLabel })}
          </p>
        </div>
      </Shell>
    )
  }

  if (readOnly) {
    return (
      <Shell title={t('quiz.title')}>
        <p className="text-sm text-bark-muted">{t('quiz.noAnswer')}</p>
      </Shell>
    )
  }

  // --- Editing the questions ------------------------------------------------
  if (editing) {
    return (
      <Shell title={t('quiz.title')} intro={t('quiz.lockedHint')}>
        <QuizQuestionEditor
          questions={chapterQuestions}
          period={period}
          onChange={(next) => onUpdateChapter({ quizQuestions: next }).catch(() => setError(t('errors.saveFailed')))}
        />
        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="mt-5 w-full flex items-center justify-center gap-2 bg-bark text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-bark/90 transition-colors"
        >
          {t('quiz.doneEditing')}
        </button>
      </Shell>
    )
  }

  // --- Answering ------------------------------------------------------------
  return (
    <Shell title={t('quiz.title')} intro={t('quiz.intro')}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-bark-muted">
          {t('quiz.questionCount', { count: questions.length })}
        </p>
        {canEditQuestions && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-sm text-kaydo font-semibold hover:underline"
          >
            <Pencil className="w-3.5 h-3.5" />
            {t('quiz.editQuestions')}
          </button>
        )}
      </div>

      {partnerSubmitted && (
        <div className="bg-kaydo/10 rounded-2xl p-4 mb-5">
          <p className="font-semibold text-bark text-sm">
            {t('quiz.partnerDoneHeading', { name: partnerLabel })}
          </p>
          <p className="text-sm text-bark-muted mt-0.5">{t('quiz.partnerDoneBody')}</p>
        </div>
      )}

      {questions.length === 0 ? (
        <p className="text-sm text-bark-muted">{t('quiz.emptyQuestions')}</p>
      ) : (
        <div className="space-y-4">
          {questions.map((question) => (
            <div key={question.id}>
              <label
                htmlFor={`quiz-${question.id}`}
                className="block font-serif text-base font-semibold text-bark leading-snug mb-2"
              >
                {question.label}
              </label>
              <textarea
                id={`quiz-${question.id}`}
                rows={2}
                value={answers[question.id] ?? ''}
                onChange={(e) => editAnswer(question.id, e.target.value)}
                placeholder={t('quiz.placeholder')}
                className="w-full px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30 resize-none"
              />
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

      {questions.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={status === 'saving' || status === 'submitting'}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border border-cream-dark text-bark hover:bg-cream-dark transition-colors disabled:opacity-50"
          >
            {status === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
            {status === 'saved' && <Check className="w-4 h-4" />}
            {status === 'saved' ? t('quiz.saved') : t('quiz.save')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={status === 'submitting'}
            className="flex-1 flex items-center justify-center gap-2 bg-bark text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-bark/90 transition-colors disabled:opacity-50"
          >
            {status === 'submitting' && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('quiz.submit')}
          </button>
        </div>
      )}
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

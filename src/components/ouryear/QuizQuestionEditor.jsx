import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { QUIZ_SUGGESTION_IDS, newQuestionId } from '../../utils/ourYear'

/**
 * Every chapter gets its own set of quiz questions. Suggestions are just that —
 * take what fits your life right now, drop the rest, add your own.
 */
export default function QuizQuestionEditor({ questions, period, onChange }) {
  const { t } = useTranslation('ourYear')
  const [draft, setDraft] = useState('')

  const used = new Set(questions.map((q) => q.presetKey).filter(Boolean))
  const available = QUIZ_SUGGESTION_IDS.filter((id) => !used.has(id))

  const labelFor = (question) =>
    question.presetKey ? t(`quiz.questions.${question.presetKey}`, { period }) : question.text

  const remove = (id) => onChange(questions.filter((q) => q.id !== id))
  const addPreset = (presetKey) => onChange([...questions, { id: presetKey, presetKey }])

  const addOwn = () => {
    const text = draft.trim()
    if (!text) return
    onChange([...questions, { id: newQuestionId(), text }])
    setDraft('')
  }

  return (
    <div className="space-y-5">
      {questions.length === 0 ? (
        <p className="text-sm text-bark-muted">{t('quiz.emptyQuestions')}</p>
      ) : (
        <ul className="space-y-2">
          {questions.map((question) => (
            <li
              key={question.id}
              className="flex items-start gap-3 bg-cream rounded-xl px-4 py-3"
            >
              <span className="flex-1 text-sm text-bark">{labelFor(question)}</span>
              <button
                type="button"
                onClick={() => remove(question.id)}
                aria-label={t('quiz.remove')}
                className="p-1 rounded-lg text-bark-muted hover:text-kaydo transition-colors flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <label htmlFor="ouryear-own-question" className="block text-sm font-medium text-bark mb-1">
          {t('quiz.ownQuestionLabel')}
        </label>
        <div className="flex gap-2">
          <input
            id="ouryear-own-question"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addOwn()
              }
            }}
            placeholder={t('quiz.ownQuestionPlaceholder')}
            className="flex-1 min-w-0 px-4 py-2.5 bg-cream-dark rounded-xl text-bark placeholder-bark-muted outline-none focus:ring-2 focus:ring-kaydo/30"
          />
          <button
            type="button"
            onClick={addOwn}
            disabled={!draft.trim()}
            className="flex items-center gap-1.5 bg-bark text-white px-4 rounded-xl text-sm font-bold hover:bg-bark/90 transition-colors disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            {t('quiz.add')}
          </button>
        </div>
      </div>

      {available.length > 0 && (
        <div>
          <p className="text-sm font-medium text-bark">{t('quiz.suggestionsHeading')}</p>
          <p className="text-xs text-bark-muted mt-0.5 mb-2">{t('quiz.suggestionsHint')}</p>
          <div className="flex flex-wrap gap-2">
            {available.map((presetKey) => (
              <button
                key={presetKey}
                type="button"
                onClick={() => addPreset(presetKey)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-dashed border-bark-muted text-sm text-bark-muted hover:border-kaydo hover:text-kaydo transition-colors text-left"
              >
                <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                {t(`quiz.questions.${presetKey}`, { period })}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

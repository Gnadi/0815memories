import { useTranslation } from 'react-i18next'

/**
 * Two perspectives on the same question, side by side. No scoring, no order of
 * merit — the differences are the point, so both columns look identical.
 */
export default function AnswerComparison({ questions, own, partner, ownName, partnerName, children }) {
  const { t } = useTranslation('ourYear')

  return (
    <div className="space-y-5">
      {questions.map((question) => (
        <div key={question.id} className="bg-cream rounded-2xl p-4">
          <p className="font-serif text-base font-semibold text-bark leading-snug">
            {question.label}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <Perspective name={ownName} answer={own?.[question.id]} empty={t('reflection.noAnswer')} />
            <Perspective name={partnerName} answer={partner?.[question.id]} empty={t('reflection.noAnswer')} />
          </div>

          {children?.(question)}
        </div>
      ))}
    </div>
  )
}

function Perspective({ name, answer, empty }) {
  const text = answer?.trim()
  return (
    <div className="bg-warm-white rounded-xl p-3">
      <p className="text-xs font-semibold text-kaydo tracking-wide uppercase mb-1.5">{name}</p>
      {text ? (
        <p className="text-sm text-bark whitespace-pre-wrap break-words">{text}</p>
      ) : (
        <p className="text-sm text-bark-muted italic">{empty}</p>
      )}
    </div>
  )
}

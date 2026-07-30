import { useTranslation } from 'react-i18next'
import { Check, Circle, CircleDot, Clock } from 'lucide-react'
import { chapterProgress } from '../../utils/ourYear'

const STEPS = ['reflection', 'quiz', 'letter', 'keepsakes']

/**
 * Where the couple stands in this chapter. Deliberately not a wizard — every
 * part stays reachable at any time, this only shows what is still open.
 */
export default function ChapterStageRail({ chapter, uid, partnerName, activeStep, onSelect }) {
  const { t } = useTranslation('ourYear')
  const progress = chapterProgress(chapter, uid)

  const iconFor = (state) => {
    if (state === 'done') return Check
    if (state === 'waiting') return Clock
    if (state === 'partial') return CircleDot
    return Circle
  }

  return (
    <nav className="flex gap-2 overflow-x-auto hide-scrollbar pb-1" aria-label={t('page.title')}>
      {STEPS.map((step) => {
        const state = progress[step]
        const Icon = iconFor(state)
        const active = activeStep === step
        return (
          <button
            key={step}
            type="button"
            onClick={() => onSelect(step)}
            title={
              state === 'waiting'
                ? t('steps.status.waiting', { name: partnerName })
                : t(`steps.status.${state}`)
            }
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              active
                ? 'bg-kaydo text-white'
                : state === 'done'
                  ? 'bg-cream-dark text-bark'
                  : 'bg-cream-dark text-bark-muted hover:text-bark'
            }`}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            {t(`steps.${step}`)}
          </button>
        )
      })}
      <button
        type="button"
        onClick={() => onSelect('summary')}
        className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
          activeStep === 'summary'
            ? 'bg-kaydo text-white'
            : 'bg-cream-dark text-bark-muted hover:text-bark'
        }`}
      >
        {t('steps.summary')}
      </button>
    </nav>
  )
}

import { useTranslation } from 'react-i18next'
import { BookHeart, Camera } from 'lucide-react'

const OPTIONS = [
  { value: 'memory', icon: BookHeart },
  { value: 'moment', icon: Camera },
]

/**
 * Segmented "Memory / Moment" switch at the top of the post modals. Picking the
 * other side hands the current form over to the other modal; nothing is written
 * until that modal is saved.
 */
export default function EntryTypeSwitch({ value, onChange, disabled }) {
  const { t } = useTranslation('memory')

  return (
    <div role="radiogroup" aria-label={t('entryType.label')} className="flex p-1 bg-cream-dark rounded-xl">
      {OPTIONS.map(({ value: option, icon: Icon }) => {
        const active = option === value
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled || active}
            onClick={() => onChange(option)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              active ? 'bg-warm-white text-kaydo shadow-sm' : 'text-bark-muted hover:text-bark disabled:opacity-60'
            }`}
          >
            <Icon className="w-4 h-4" />
            {t(`entryType.${option}`)}
          </button>
        )
      })}
    </div>
  )
}

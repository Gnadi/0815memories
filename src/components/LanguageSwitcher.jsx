import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '../i18n'

// Language switcher. `changeLanguage` persists the choice to localStorage via
// the i18next-browser-languagedetector cache (key: kaydo_lang), so the pick
// survives reloads.
//
// variant:
//   "sidebar"  — compact segmented control for the navigation sidebar
//   "settings" — labelled block with a leading icon for the settings page
export default function LanguageSwitcher({ variant = 'sidebar' }) {
  const { t, i18n } = useTranslation('common')
  const current = (i18n.language || 'en').split('-')[0]

  const handleChange = (lng) => {
    if (lng !== current) i18n.changeLanguage(lng)
  }

  const segmented = (
    <div className="inline-flex rounded-xl bg-cream-dark p-0.5" role="group" aria-label={t('language.label')}>
      {SUPPORTED_LANGUAGES.map((lng) => {
        const active = current === lng
        return (
          <button
            key={lng}
            type="button"
            onClick={() => handleChange(lng)}
            aria-pressed={active}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              active ? 'bg-kaydo text-white shadow-sm' : 'text-bark-light hover:text-bark'
            }`}
          >
            {t(`language.${lng}`)}
          </button>
        )
      })}
    </div>
  )

  if (variant === 'settings') {
    return (
      <div>
        <label className="block text-sm font-medium text-bark mb-1.5">
          <div className="flex items-center gap-1.5">
            <Languages className="w-4 h-4" />
            {t('language.label')}
          </div>
        </label>
        <p className="text-xs text-bark-muted mb-3">
          {t('language.description')}
        </p>
        {segmented}
      </div>
    )
  }

  return segmented
}

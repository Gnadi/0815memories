import { ChevronDown, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES } from '../i18n'

// Language switcher. `changeLanguage` persists the choice to localStorage via
// the i18next-browser-languagedetector cache (key: kaydo_lang), so the pick
// survives reloads.
//
// variant:
//   "sidebar"  — compact dropdown for the navigation sidebar and page headers
//   "settings" — labelled block with a leading icon for the settings page
//
// language, onSelect — for a page whose address decides its language, like
// the landing page (LANDING_PATHS in src/i18n): the language the page is in,
// which the switcher then shows and speaks, and what to do with a pick in
// place of switching where the visitor is.
export default function LanguageSwitcher({ variant = 'sidebar', language, onSelect }) {
  const { t, i18n } = useTranslation('common', { lng: language })
  const current = (language || i18n.language || 'en').split('-')[0]

  const handleChange = (lng) => {
    if (lng === current) return
    if (onSelect) onSelect(lng)
    else i18n.changeLanguage(lng)
  }

  // A dropdown rather than one button per language: there are four now, and
  // the list keeps growing in a header with little room. Each option is named
  // in its own language so a visitor can find theirs without reading another.
  const dropdown = (
    <div className="relative inline-flex items-center">
      <Languages className="pointer-events-none absolute start-3 w-4 h-4 text-bark-light" aria-hidden="true" />
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        aria-label={t('language.label')}
        className="appearance-none rounded-xl bg-cream-dark ps-9 pe-8 py-1.5 text-sm font-medium text-bark cursor-pointer hover:bg-cream-dark/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-kaydo/40"
      >
        {SUPPORTED_LANGUAGES.map((lng) => (
          <option key={lng} value={lng}>{t(`language.${lng}`)}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute end-2.5 w-4 h-4 text-bark-light" aria-hidden="true" />
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
        {dropdown}
      </div>
    )
  }

  return dropdown
}

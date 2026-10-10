import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDate, formatRelativeDate, timeAgo } from '../utils/helpers'

/**
 * The date formatters of utils/helpers.js, in the reader's language. They take
 * the language as an argument so they can be tested without React; this hook
 * is where components get it, and what re-renders them when it changes.
 */
export function useDateFormat() {
  const { t, i18n } = useTranslation('common')
  const locale = i18n.language
  return useMemo(() => ({
    locale,
    formatDate: (date) => formatDate(date, locale),
    formatRelativeDate: (date) => formatRelativeDate(date, locale),
    timeAgo: (date) => timeAgo(date, locale, { justNow: t('time.justNow') }),
  }), [locale, t])
}

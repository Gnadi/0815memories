import { monthDate } from '../../utils/bestOf'

/**
 * The words a best-of is shown with, in the reader's language. The best-of
 * itself carries none (utils/bestOf.js), so the same story reads in German for
 * one member of the family and in English for the next.
 */
export function bestOfLabels(month, lang, t) {
  const date = monthDate(month)
  const monthName = date.toLocaleDateString(lang, { month: 'long' })
  const formatDay = (day, options) => {
    const [y, m, d] = day.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(lang, options)
  }
  return {
    monthName,
    monthYear: date.toLocaleDateString(lang, { month: 'long', year: 'numeric' }),
    // "SEPT", "SEP": the opening card's big word, without the abbreviation's dot.
    monthShort: date.toLocaleDateString(lang, { month: 'short' }).replace(/\.$/, '').toUpperCase(),
    year: String(date.getFullYear()),
    title: t('title', { month: monthName }),
    circle: t('circle', { month: date.toLocaleDateString(lang, { month: 'short' }) }),
    longDay: (day) => (day ? formatDay(day, { weekday: 'long', day: 'numeric', month: 'long' }) : ''),
    // "14 Sep · Zell am See" under a photo.
    meta: (slide) =>
      [slide.day && formatDay(slide.day, { day: 'numeric', month: 'short' }), slide.location].filter(Boolean).join(' · '),
  }
}

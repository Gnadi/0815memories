/**
 * Dates formatted with one Intl formatter per language and options, kept.
 *
 * `toLocaleDateString` builds a new formatter, locale data and all, on every
 * call. Lists call it for every item on every render: 200 moments × 3 dates
 * took about 200 ms on a throttled phone, against 2 ms with formatters kept.
 */
const formatters = new Map()

function formatterFor(Kind, locale, options) {
  const key = `${Kind.name}|${locale ?? ''}|${JSON.stringify(options)}`
  let formatter = formatters.get(key)
  if (!formatter) {
    formatter = new Kind(locale, options)
    formatters.set(key, formatter)
  }
  return formatter
}

/** What `date.toLocaleDateString(locale, options)` gives, without the cost. */
export function formatDateIn(date, locale, options = {}) {
  return formatterFor(Intl.DateTimeFormat, locale, options).format(date)
}

/** A kept Intl.RelativeTimeFormat. */
export function relativeTimeFormat(locale, options = {}) {
  return formatterFor(Intl.RelativeTimeFormat, locale, options)
}

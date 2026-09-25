/**
 * The words under a sky map. Kept apart from the page so it can be tested, and
 * apart from the renderer so the renderer stays free of i18n.
 */
import { countryName } from './skyData'

/** 'YYYY-MM-DD' of a birthdate stored as a Firestore Timestamp (UTC midnight). */
export function birthDateString(birthdate) {
  if (!birthdate) return null
  const date = birthdate.toDate ? birthdate.toDate() : new Date(birthdate.seconds ? birthdate.seconds * 1000 : birthdate)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

export function formatWallDate(dateStr, lang) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d))
  )
}

export function formatCoordinates(lat, lon) {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(2)}° ${ns} · ${Math.abs(lon).toFixed(2)}° ${ew}`
}

function joinList(items, lang) {
  try {
    return new Intl.ListFormat(lang, { style: 'long', type: 'conjunction' }).format(items)
  } catch {
    return items.join(', ')
  }
}

/**
 * @returns {{ title: string, lines: string[] }}
 */
export function buildCaption({ t, lang, title, dateStr, timeStr, place, sky, dedication }) {
  const lines = []
  const date = formatWallDate(dateStr, lang)
  lines.push(timeStr ? t('caption.dateTime', { date, time: timeStr }) : date)

  if (place) {
    const where = place.country ? `${place.name}, ${countryName(place.country, lang)}` : place.name
    lines.push(`${where} · ${formatCoordinates(place.lat, place.lon)}`)
  }

  if (sky) {
    const moon = t(`moon.${sky.moon.phase}`)
    const planets = sky.visiblePlanets.map((b) => t(`planets.${b}`))
    lines.push(
      planets.length
        ? t('caption.moonAndPlanets', { moon, planets: joinList(planets, lang), count: planets.length })
        : moon
    )
    if (!timeStr) lines.push(t('caption.nightOf'))
    else if (sky.daylight) lines.push(t('caption.daylight'))
  }

  if (dedication?.trim()) lines.push(dedication.trim())
  return { title, lines }
}

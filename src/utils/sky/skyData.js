/**
 * Loads the static sky data from public/sky/ (built by scripts/build-sky-data.mjs)
 * and searches the bundled place list.
 *
 * Places are searched here, in the browser, on purpose: typing a child's
 * birthplace into a third-party geocoder would hand it to that service.
 */
import tzlookup from 'tz-lookup'

let catalogPromise = null
let placesPromise = null

async function fetchJson(path) {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`)
  return res.json()
}

/** Stars and constellations, fetched once per session. */
export function loadSkyCatalog() {
  if (!catalogPromise) {
    catalogPromise = Promise.all([fetchJson('/sky/stars.json'), fetchJson('/sky/constellations.json')])
      .then(([stars, constellations]) => ({ stars, constellations }))
      .catch((err) => {
        catalogPromise = null
        throw err
      })
  }
  return catalogPromise
}

/** [name, countryCode, lat, lon] rows, biggest places first. */
export function loadPlaces() {
  if (!placesPromise) {
    placesPromise = fetchJson('/sky/cities.json').catch((err) => {
      placesPromise = null
      throw err
    })
  }
  return placesPromise
}

export function normalizeForSearch(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .trim()
}

/**
 * Up to `limit` places matching `query`: names that start with it first, then
 * names that contain it; within each group bigger places first (the list is
 * already sorted by population).
 */
export function searchPlaces(rows, query, limit = 8) {
  const q = normalizeForSearch(query)
  if (q.length < 2) return []
  const starts = []
  const contains = []
  for (const row of rows) {
    const name = normalizeForSearch(row[0])
    if (name.startsWith(q)) {
      starts.push(row)
      if (starts.length >= limit) break
    } else if (contains.length < limit && name.includes(q)) {
      contains.push(row)
    }
  }
  return [...starts, ...contains].slice(0, limit).map(([name, country, lat, lon]) => ({ name, country, lat, lon }))
}

/** The IANA time zone at a point, e.g. 'Europe/Vienna'. */
export function timeZoneAt(lat, lon) {
  return tzlookup(lat, lon)
}

/**
 * A place ready to store: rounded to 0.01° (about 1 km — invisible in the sky)
 * and with its time zone resolved, so the sky never needs a lookup later.
 */
export function makeBirthPlace({ name, country = '', lat, lon }) {
  const rlat = Math.round(lat * 100) / 100
  const rlon = Math.round(lon * 100) / 100
  return { name, country, lat: rlat, lon: rlon, tz: timeZoneAt(rlat, rlon) }
}

export function countryName(code, lang) {
  if (!code) return ''
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code) || code
  } catch {
    return code
  }
}

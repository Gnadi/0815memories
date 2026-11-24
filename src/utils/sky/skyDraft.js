/**
 * A birth sky made on the public page, carried through signing up.
 *
 * Someone who designs a poster before having an account goes through three
 * steps first — the account, the confirmation mail, the family — and the mail
 * often opens in another tab. So the poster's details wait in this browser's
 * localStorage until the new family has a child to keep them with
 * (BirthSkyContinuePage), and are deleted there. They are written only when
 * the visitor asks to keep or order the poster, never while they try it out,
 * and they expire after DRAFT_VALID_DAYS so a forgotten draft does not linger
 * on a shared computer.
 *
 * Nothing here is sent anywhere: once in the family the details are encrypted
 * like every child's (services/kids.js).
 */

// The poster styles of skyRenderer.js, named here rather than imported: the
// sign-up page reads drafts, and importing the renderer would bring the
// astronomy library into its chunk. A test keeps the two lists the same.
export const DRAFT_STYLES = ['midnight', 'kaydo', 'minimal']

export const SKY_DRAFT_KEY = 'kaydo_sky_draft'
export const DRAFT_VALID_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/

const text = (value, max) => (typeof value === 'string' ? value.slice(0, max) : '')

function placeOf(value) {
  if (!value || typeof value !== 'object') return null
  const { name, country, lat, lon, tz } = value
  if (typeof name !== 'string' || !Number.isFinite(lat) || !Number.isFinite(lon) || typeof tz !== 'string') return null
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { name: name.slice(0, 100), country: typeof country === 'string' ? country.slice(0, 3) : '', lat, lon, tz }
}

/** The draft's fields, checked; null when something essential is missing. */
export function readDraft(value, now = Date.now()) {
  if (!value || typeof value !== 'object') return null
  const savedAt = Number(value.savedAt)
  if (!Number.isFinite(savedAt) || now - savedAt > DRAFT_VALID_DAYS * DAY_MS) return null
  const name = text(value.name, 40).trim()
  const birthDate = DATE.test(value.birthDate) ? value.birthDate : null
  const birthPlace = placeOf(value.birthPlace)
  if (!name || !birthDate || !birthPlace) return null
  return {
    name,
    birthDate,
    birthTime: TIME.test(value.birthTime) ? value.birthTime : '',
    birthPlace,
    skyStyle: DRAFT_STYLES.includes(value.skyStyle) ? value.skyStyle : 'midnight',
    title: text(value.title, 40),
    dedication: text(value.dedication, 80),
    order: value.order === true,
    savedAt,
  }
}

export function saveSkyDraft(draft, now = Date.now()) {
  const checked = readDraft({ ...draft, savedAt: now }, now)
  if (!checked) return false
  try {
    localStorage.setItem(SKY_DRAFT_KEY, JSON.stringify(checked))
    return true
  } catch {
    return false
  }
}

export function loadSkyDraft(now = Date.now()) {
  try {
    const raw = localStorage.getItem(SKY_DRAFT_KEY)
    if (!raw) return null
    const draft = readDraft(JSON.parse(raw), now)
    // An expired or damaged draft goes at once rather than at the next save.
    if (!draft) localStorage.removeItem(SKY_DRAFT_KEY)
    return draft
  } catch {
    return null
  }
}

export function clearSkyDraft() {
  try {
    localStorage.removeItem(SKY_DRAFT_KEY)
  } catch {
    // Storage that cannot be read holds no draft either.
  }
}

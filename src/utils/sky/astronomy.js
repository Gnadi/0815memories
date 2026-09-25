/**
 * The astronomy behind "Sky of your birth": which stars, planets and which moon
 * stood where above a place at a moment. Pure functions, all on the device —
 * the birthplace never leaves the browser.
 *
 * Positions come from astronomy-engine, which is far more precise than a poster
 * can show. Stars arrive as J2000 right ascension / declination and are turned
 * into altitude / azimuth with one rotation matrix per sky (it carries
 * precession, nutation and the Earth's rotation), so 5,000 stars cost 5,000
 * matrix products and nothing more.
 */
import {
  Body,
  Observer,
  MakeTime,
  Equator,
  Horizon,
  Illumination,
  MoonPhase,
  SearchRiseSet,
  Rotation_EQJ_HOR,
  RotateVector,
  Vector,
  HorizonFromVector,
} from 'astronomy-engine'

const DEG = Math.PI / 180

/** The hour we draw when nobody knows the birth time: the night of that day. */
export const DEFAULT_NIGHT_TIME = '22:00'

export const PLANETS = [Body.Mercury, Body.Venus, Body.Mars, Body.Jupiter, Body.Saturn]

// ── Time ────────────────────────────────────────────────────────────

/**
 * Offset of `timeZone` from UTC at the instant `date`, in minutes.
 * Uses the browser's own time-zone database (ICU), historical DST rules
 * included, so a 1985 birth in Vienna gets 1985's rules.
 */
export function timeZoneOffsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const get = (type) => Number(parts.find((p) => p.type === type).value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000)
}

/**
 * The UTC instant of a wall-clock time at a place: "04:17 on 3 May 2021 in
 * Europe/Vienna". Two passes settle the offset across a DST change; a time that
 * falls into the hour skipped in spring resolves to the instant just after it.
 */
export function zonedTimeToUtc(dateStr, timeStr, timeZone) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number)
  const wall = Date.UTC(y, m - 1, d, hh, mm)
  let utc = wall - timeZoneOffsetMinutes(new Date(wall), timeZone) * 60000
  utc = wall - timeZoneOffsetMinutes(new Date(utc), timeZone) * 60000
  return new Date(utc)
}

// ── Projection ──────────────────────────────────────────────────────

/**
 * Stereographic projection centred on the zenith, as seen lying on your back:
 * north at the top, east on the LEFT. Returns unit-disc coordinates — the
 * horizon is radius 1, the zenith (0, 0). Points below the horizon land outside
 * the disc and are clipped by the renderer.
 */
export function project(altitude, azimuth) {
  const r = Math.tan(((90 - altitude) * DEG) / 2) // tan(45°) = 1 at the horizon
  return { x: -r * Math.sin(azimuth * DEG), y: -r * Math.cos(azimuth * DEG) }
}

// ── The sky ─────────────────────────────────────────────────────────

function toHorizontal(rotation, time, raDeg, decDeg) {
  const cosDec = Math.cos(decDeg * DEG)
  const v = new Vector(
    cosDec * Math.cos(raDeg * DEG),
    cosDec * Math.sin(raDeg * DEG),
    Math.sin(decDeg * DEG),
    time
  )
  const h = HorizonFromVector(RotateVector(rotation, v), 'normal')
  return { alt: h.lat, az: h.lon }
}

function moonPhaseKey(angle) {
  // 0 = new, 90 = first quarter, 180 = full, 270 = last quarter.
  const keys = ['new', 'waxingCrescent', 'firstQuarter', 'waxingGibbous', 'full', 'waningGibbous', 'lastQuarter', 'waningCrescent']
  return keys[Math.round(angle / 45) % 8]
}

function riseSet(body, observer, time, direction) {
  // Search from the local midnight-ish start of that day: half a day back.
  const found = SearchRiseSet(body, observer, direction, time.AddDays(-0.5), 1)
  return found ? found.date : null
}

/**
 * Everything a sky map needs for one moment and place.
 *
 * @param {object} args
 * @param {Date}   args.date   the UTC instant
 * @param {number} args.lat    degrees north
 * @param {number} args.lon    degrees east
 * @param {Array}  args.stars  [raDeg, decDeg, mag, bv] rows from public/sky/stars.json
 * @param {Array}  args.constellations  rows from public/sky/constellations.json
 */
export function computeSky({ date, lat, lon, stars = [], constellations = [] }) {
  const time = MakeTime(date)
  const observer = new Observer(lat, lon, 0)
  const rotation = Rotation_EQJ_HOR(time, observer)
  const horizontal = (ra, dec) => toHorizontal(rotation, time, ra, dec)

  const starPoints = stars.map(([ra, dec, mag, bv]) => ({ ...horizontal(ra, dec), mag, bv }))

  const constellationShapes = constellations.map((c) => ({
    id: c.id,
    rank: c.rank,
    name: c.name,
    label: horizontal(c.pos[0], c.pos[1]),
    lines: c.lines.map((line) => line.map(([ra, dec]) => horizontal(ra, dec))),
  }))

  const bodyPosition = (body) => {
    const eq = Equator(body, time, observer, true, true)
    const h = Horizon(time, observer, eq.ra, eq.dec, 'normal')
    return { alt: h.altitude, az: h.azimuth }
  }

  const planets = PLANETS.map((body) => ({
    body,
    ...bodyPosition(body),
    mag: Illumination(body, time).mag,
  }))

  const phaseAngle = MoonPhase(time)
  const moon = {
    ...bodyPosition(Body.Moon),
    phaseAngle,
    illumination: Illumination(Body.Moon, time).phase_fraction,
    phase: moonPhaseKey(phaseAngle),
  }

  const sun = {
    ...bodyPosition(Body.Sun),
    rise: riseSet(Body.Sun, observer, time, +1),
    set: riseSet(Body.Sun, observer, time, -1),
  }

  return {
    date,
    lat,
    lon,
    stars: starPoints,
    constellations: constellationShapes,
    planets,
    visiblePlanets: planets.filter((p) => p.alt > 0).map((p) => p.body),
    moon,
    sun,
    // Civil twilight and brighter: the stars were there, the daylight hid them.
    daylight: sun.alt > -6,
  }
}

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { computeSky, zonedTimeToUtc, project, timeZoneOffsetMinutes } from '../utils/sky/astronomy'
import { searchPlaces, makeBirthPlace, normalizeForSearch } from '../utils/sky/skyData'
import { buildCaption, birthDateString, formatCoordinates } from '../utils/sky/caption'

// Relative to the repo root, where vitest runs — as memoryRules.test.js reads firestore.rules.
const publicSky = (file) => JSON.parse(readFileSync(`public/sky/${file}`, 'utf8'))
const stars = publicSky('stars.json')
const constellations = publicSky('constellations.json')

// Polaris: RA 37.95°, Dec +89.26° — about 0.7° from the celestial pole.
const polarisIndex = stars.findIndex(([ra, dec]) => Math.abs(ra - 37.95) < 0.5 && dec > 89)

describe('zonedTimeToUtc', () => {
  it('turns a Vienna wall-clock time in summer into UTC (CEST, +2)', () => {
    expect(zonedTimeToUtc('2021-05-03', '04:17', 'Europe/Vienna').toISOString()).toBe('2021-05-03T02:17:00.000Z')
  })

  it('moves a birth just after midnight to the previous UTC day', () => {
    expect(zonedTimeToUtc('2021-05-03', '00:30', 'Europe/Vienna').toISOString()).toBe('2021-05-02T22:30:00.000Z')
  })

  it('uses winter time in January (CET, +1)', () => {
    expect(zonedTimeToUtc('2020-01-15', '12:00', 'Europe/Vienna').toISOString()).toBe('2020-01-15T11:00:00.000Z')
  })

  it('handles zones west of Greenwich and the southern hemisphere', () => {
    expect(zonedTimeToUtc('2019-07-04', '21:00', 'America/New_York').toISOString()).toBe('2019-07-05T01:00:00.000Z')
    // Sydney is on daylight time (+11) in January.
    expect(zonedTimeToUtc('2022-01-10', '09:00', 'Australia/Sydney').toISOString()).toBe('2022-01-09T22:00:00.000Z')
  })

  it('reports offsets in minutes', () => {
    expect(timeZoneOffsetMinutes(new Date('2021-07-01T12:00:00Z'), 'Europe/Vienna')).toBe(120)
    expect(timeZoneOffsetMinutes(new Date('2021-07-01T12:00:00Z'), 'Asia/Kolkata')).toBe(330)
  })
})

describe('project', () => {
  it('puts the zenith in the centre and the horizon on the unit circle', () => {
    const z = project(90, 123)
    expect(Math.hypot(z.x, z.y)).toBeCloseTo(0, 10)
    const h = project(0, 200)
    expect(Math.hypot(h.x, h.y)).toBeCloseTo(1, 10)
  })

  it('draws north at the top and east on the left, as seen looking up', () => {
    const north = project(0, 0)
    const east = project(0, 90)
    expect(north.y).toBeCloseTo(-1, 10)
    expect(north.x).toBeCloseTo(0, 10)
    expect(east.x).toBeCloseTo(-1, 10)
  })
})

describe('computeSky', () => {
  it('finds Polaris at an altitude close to the latitude in Linz', () => {
    const sky = computeSky({ date: new Date('2021-05-02T22:30:00Z'), lat: 48.31, lon: 14.29, stars })
    const polaris = sky.stars[polarisIndex]
    expect(Math.abs(polaris.alt - 48.31)).toBeLessThan(1.2)
    // …and due north.
    expect(Math.min(polaris.az, 360 - polaris.az)).toBeLessThan(2)
  })

  it('has Polaris below the horizon in Sydney', () => {
    const sky = computeSky({ date: new Date('2022-01-09T22:00:00Z'), lat: -33.87, lon: 151.21, stars })
    expect(sky.stars[polarisIndex].alt).toBeLessThan(-30)
  })

  it('shows a full moon on the night of the April 2024 full moon', () => {
    const sky = computeSky({ date: new Date('2024-04-23T23:49:00Z'), lat: 48.2, lon: 16.37 })
    expect(sky.moon.phase).toBe('full')
    expect(sky.moon.illumination).toBeGreaterThan(0.99)
  })

  it('shows a new moon at the April 2024 solar eclipse', () => {
    const sky = computeSky({ date: new Date('2024-04-08T18:21:00Z'), lat: 40, lon: -83 })
    expect(sky.moon.phase).toBe('new')
    expect(sky.moon.illumination).toBeLessThan(0.01)
    expect(sky.daylight).toBe(true)
  })

  it('knows night from day', () => {
    const night = computeSky({ date: new Date('2021-05-02T22:30:00Z'), lat: 48.31, lon: 14.29 })
    const noon = computeSky({ date: new Date('2021-05-03T10:30:00Z'), lat: 48.31, lon: 14.29 })
    expect(night.daylight).toBe(false)
    expect(noon.daylight).toBe(true)
    expect(noon.sun.alt).toBeGreaterThan(50)
  })

  it('carries every constellation with its lines in horizontal coordinates', () => {
    const sky = computeSky({ date: new Date('2021-05-02T22:30:00Z'), lat: 48.31, lon: 14.29, constellations })
    expect(sky.constellations).toHaveLength(constellations.length)
    const uma = sky.constellations.find((c) => c.id === 'UMa')
    expect(uma.name.de).toBe('Großer Bär')
    // The Big Dipper is high in a May night sky over Austria.
    expect(uma.label.alt).toBeGreaterThan(40)
  })
})

describe('places', () => {
  const rows = [
    ['Vienna', 'AT', 48.21, 16.37],
    ['Linz', 'AT', 48.31, 14.29],
    ['Lienz', 'AT', 46.83, 12.77],
    ['Klingenbach', 'AT', 47.75, 16.54],
    ['Zürich', 'CH', 47.37, 8.55],
  ]

  it('ignores accents and case', () => {
    expect(normalizeForSearch('Zürich')).toBe('zurich')
    expect(searchPlaces(rows, 'zurich').map((p) => p.name)).toEqual(['Zürich'])
  })

  it('ranks names that start with the query before names that contain it', () => {
    expect(searchPlaces(rows, 'li').map((p) => p.name)).toEqual(['Linz', 'Lienz', 'Klingenbach'])
  })

  it('answers from the list it is given, also after searching another', () => {
    // Names are normalised once per list and kept; a second list is its own.
    expect(searchPlaces(rows, 'vie').map((p) => p.name)).toEqual(['Vienna'])
    const other = [['Vielsalm', 'BE', 50.28, 5.92]]
    expect(searchPlaces(other, 'vie').map((p) => p.name)).toEqual(['Vielsalm'])
    expect(searchPlaces(rows, 'vie').map((p) => p.name)).toEqual(['Vienna'])
  })

  it('needs at least two characters', () => {
    expect(searchPlaces(rows, 'l')).toEqual([])
  })

  it('rounds a birthplace to about a kilometre and resolves its time zone', () => {
    expect(makeBirthPlace({ name: 'Linz', country: 'AT', lat: 48.30639, lon: 14.28611 })).toEqual({
      name: 'Linz',
      country: 'AT',
      lat: 48.31,
      lon: 14.29,
      tz: 'Europe/Vienna',
    })
  })
})

describe('caption', () => {
  const t = (key, vars = {}) => `${key}${Object.keys(vars).length ? JSON.stringify(vars) : ''}`

  it('reads the birthdate as the calendar day it was entered as', () => {
    // AddKidModal stores new Date('2021-05-03'), which is UTC midnight.
    const stored = { toDate: () => new Date('2021-05-03') }
    expect(birthDateString(stored)).toBe('2021-05-03')
    expect(birthDateString({ seconds: Date.UTC(2021, 4, 3) / 1000 })).toBe('2021-05-03')
    expect(birthDateString(null)).toBeNull()
  })

  it('formats coordinates with hemispheres', () => {
    expect(formatCoordinates(48.31, 14.29)).toBe('48.31° N · 14.29° E')
    expect(formatCoordinates(-33.87, -70.65)).toBe('33.87° S · 70.65° W')
  })

  it('says it is the night of that day when the time is unknown', () => {
    const sky = computeSky({ date: zonedTimeToUtc('2021-05-03', '22:00', 'Europe/Vienna'), lat: 48.31, lon: 14.29 })
    const caption = buildCaption({
      t,
      lang: 'en',
      title: 'Leo',
      dateStr: '2021-05-03',
      timeStr: '',
      place: { name: 'Linz', country: 'AT', lat: 48.31, lon: 14.29 },
      sky,
      dedication: '  The night the world got brighter ',
    })
    expect(caption.title).toBe('Leo')
    expect(caption.lines[0]).toBe('May 3, 2021')
    expect(caption.lines[1]).toBe('Linz, Austria · 48.31° N · 14.29° E')
    expect(caption.lines).toContain('caption.nightOf')
    expect(caption.lines.at(-1)).toBe('The night the world got brighter')
  })

  it('notes a daylight birth when the time is known', () => {
    const sky = computeSky({ date: zonedTimeToUtc('2021-05-03', '12:30', 'Europe/Vienna'), lat: 48.31, lon: 14.29 })
    const caption = buildCaption({ t, lang: 'en', title: 'Leo', dateStr: '2021-05-03', timeStr: '12:30', sky })
    expect(caption.lines[0]).toBe('caption.dateTime{"date":"May 3, 2021","time":"12:30"}')
    expect(caption.lines).toContain('caption.daylight')
  })
})

describe('posterLanguage', () => {
  it('draws in the languages the sky data names constellations in, else English', async () => {
    const { posterLanguage } = await import('../utils/sky/caption')
    expect(posterLanguage('de-AT')).toBe('de')
    expect(posterLanguage('fr')).toBe('fr')
    expect(posterLanguage('ar')).toBe('ar')
    expect(posterLanguage('es')).toBe('en')
    expect(posterLanguage(undefined)).toBe('en')
  })

  it('keeps the coordinates in one piece in an Arabic caption', () => {
    const t = (key, opts) => (opts?.moon ? `${opts.moon} ${opts.planets}` : key)
    const place = { name: 'Cairo', country: 'EG', lat: 30.06, lon: 31.25 }
    const ar = buildCaption({ t, lang: 'ar', title: 'ليلى', dateStr: '2026-11-20', timeStr: '04:17', place, sky: null })
    expect(ar.lines[1]).toContain('\u206630.06° N · 31.25° E\u2069')
    const en = buildCaption({ t, lang: 'en', title: 'Leo', dateStr: '2026-11-20', timeStr: '04:17', place, sky: null })
    expect(en.lines[1]).not.toMatch(/[\u2066\u2069]/)
  })

  it('has every constellation named in every poster language', async () => {
    const { POSTER_LANGUAGES } = await import('../utils/sky/caption')
    const constellations = JSON.parse(readFileSync('public/sky/constellations.json', 'utf8'))
    for (const c of constellations) {
      for (const lng of POSTER_LANGUAGES) expect(c.name[lng], `${c.id} in ${lng}`).toBeTruthy()
    }
  })
})

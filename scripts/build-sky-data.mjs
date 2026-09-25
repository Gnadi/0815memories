#!/usr/bin/env node
/**
 * Builds the static data behind "Sky of your birth" into public/sky/.
 *
 * The sources are not app dependencies — they are only needed to regenerate
 * these files, so they are installed somewhere else and passed in:
 *
 *   npm i --prefix /tmp/skysrc d3-celestial@0.7.35 all-the-cities@3.1.0
 *   node scripts/build-sky-data.mjs /tmp/skysrc/node_modules
 *
 * Outputs (all served as plain static files, fetched only by the sky page):
 *   stars.json           [raDeg, decDeg, mag, bv] for every star to magnitude 6
 *   constellations.json  lines, label position and EN/DE names per constellation
 *   cities.json          places with at least 5,000 inhabitants, biggest first
 *
 * Licences: star and constellation data © Olaf Frohn, d3-celestial (BSD-3-Clause);
 * places from GeoNames (CC BY 4.0) via all-the-cities.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const src = process.argv[2]
if (!src) {
  console.error('usage: node scripts/build-sky-data.mjs <dir containing d3-celestial and all-the-cities>')
  process.exit(1)
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sky')
mkdirSync(out, { recursive: true })

const readJson = (p) => JSON.parse(readFileSync(join(src, p), 'utf8'))
const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d
// d3-celestial stores right ascension as a longitude in -180..180.
const ra = (lon) => round(lon < 0 ? lon + 360 : lon, 3)

// ── Stars ───────────────────────────────────────────────────────────
const stars = readJson('d3-celestial/data/stars.6.json')
  .features.map((f) => {
    const [lon, lat] = f.geometry.coordinates
    const bv = parseFloat(f.properties.bv)
    return [ra(lon), round(lat, 3), round(f.properties.mag, 2), Number.isFinite(bv) ? round(bv, 2) : 0.6]
  })
  // Brightest first, so the renderer paints faint stars underneath bright ones.
  .sort((a, b) => b[2] - a[2])
writeFileSync(join(out, 'stars.json'), JSON.stringify(stars))

// ── Constellations ──────────────────────────────────────────────────
const lines = new Map(
  readJson('d3-celestial/data/constellations.lines.json').features.map((f) => [
    f.id,
    f.geometry.coordinates.map((line) => line.map(([lon, lat]) => [ra(lon), round(lat, 3)])),
  ])
)
// The source uses typographic spaces (U+2005) inside some names; the poster
// font may not have that glyph.
const clean = (name) => name.normalize('NFC').replace(/\s+/gu, ' ').trim()
const constellations = readJson('d3-celestial/data/constellations.json').features.map((f) => {
  const [lon, lat] = f.geometry.coordinates
  return {
    id: f.id,
    rank: Number(f.properties.rank),
    name: { en: clean(f.properties.en || f.properties.name), de: clean(f.properties.de || f.properties.name) },
    pos: [ra(lon), round(lat, 3)],
    lines: lines.get(f.id) || [],
  }
})
writeFileSync(join(out, 'constellations.json'), JSON.stringify(constellations))

// ── Places ──────────────────────────────────────────────────────────
const require = createRequire(join(src, 'all-the-cities', 'index.js'))
const cities = require(join(src, 'all-the-cities'))
  .filter((c) => c.population >= 5000)
  .sort((a, b) => b.population - a.population)
  // Two decimals is ~1 km, which the sky cannot tell apart.
  .map((c) => [c.name, c.country, round(c.loc.coordinates[1], 2), round(c.loc.coordinates[0], 2)])
writeFileSync(join(out, 'cities.json'), JSON.stringify(cities))

console.log(`stars ${stars.length}, constellations ${constellations.length}, places ${cities.length} → ${out}`)

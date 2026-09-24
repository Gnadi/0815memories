# Sky of your birth — the stars above the night you arrived

For every child (and anyone else in the family) Kaydo draws the sky above the
place they were born, at the time they were born: stars, constellations, the
moon in its exact phase, the planets that were up. It is shown in the app and
can be exported as a poster.

> **Status:** plan. Nothing is built yet.

## Analysis

**Why it fits Kaydo.** It turns two facts families already enter (a birth date
and a place) into something beautiful and one-of-a-kind that no photo can show.
It is a gift-shaped feature: a poster over the cot, a card for the grandparents.
Kaydo can also do it privately: star-map shops ask for the birth date, time and
place of your child and keep them. Kaydo can compute everything on the device.

**It is cheaper than it looks.** The astronomy is solved and small:

| Piece | Source | License | Size (gz) |
| --- | --- | --- | --- |
| Sun, moon, planet positions, moon phase | `astronomy-engine` | MIT | ~40 KB |
| Stars to magnitude ~6 (what the eye sees) | Yale Bright Star Catalogue / HYG subset (~5,000 stars) | public domain / CC BY-SA | ~60 KB |
| Constellation lines + names | d3-celestial data files | BSD-3 | ~30 KB |
| Place → coordinates + time zone | GeoNames `cities15000` subset | CC BY 4.0 | ~500 KB |

All of this loads lazily in its own chunk, only when someone opens the feature.

**Privacy decision: no geocoding API.** Typing "Linz" into a third-party
geocoder would send the birthplace of a child to that service. Kaydo bundles
the city list instead (lazy-loaded) and offers "drop a pin" as a fallback for
villages. The coordinates are rounded to 0.01° (~1 km), which makes no visible
difference to the sky.

**Birth time.** Often only roughly known. With a time the map is exact. Without
one, it shows *"the night sky above Linz on the night of 3 May 2021"*
(at 22:00 local time) and says so on the poster. It is honest and still
beautiful.

**Time zones matter.** A birth at 00:30 in Vienna is 22:30 UTC the day
before. The city dataset carries an IANA zone id, and `Intl.DateTimeFormat`
with `timeZone` (including historical DST rules) converts local birth time to
UTC with no extra library.

## What is computed

1. Local birth time + zone → UTC instant → Julian date.
2. Local sidereal time at the place.
3. For every star (RA/Dec, J2000 → precessed to date): altitude/azimuth.
   Stars below the horizon are dropped.
4. Moon + planets via `astronomy-engine` (topocentric), moon phase angle and
   illumination for drawing the lit part correctly.
5. Stereographic projection centred on the zenith, so the map looks like
   lying on your back and looking up. North up, east **left** (as seen from
   below). A tiny compass shows it.
6. Extras for the caption: sunrise/sunset, moon phase name, which planets were
   visible.

## Output

- **One renderer, Canvas 2D:** preview, thumbnail and poster all come from the
  same function, the same "what you see is what you get" approach
  `src/utils/collageRenderer.js` uses for collages.
- **Styles:** *Midnight* (navy, white stars), *Kaydo* (cream paper, terracotta
  lines, matches the app), *Minimal* (black on white, for printing at home).
- **Poster export:** PNG at A4/A3 in 300 dpi (A3 = 3508 × 4961 px), and a PDF via
  jspdf. The caption is editable: name, date, place, a line of text. If the
  [handwriting font](plan-handwriting-font.md) exists, the caption can be set in
  it.
- **Post to feed:** as a memory, like collages and highlight reels do today.

**Beyond birth.** The same renderer takes any date + place. That gives:

- *"The sky over our wedding"* as an Our Year keepsake
- *"The night we moved in"*
- a small "sky" button on any memory with a date and a place

## Data model

Children today store `birthdate` as a **plain, unencrypted** Timestamp
(`src/components/admin/AddKidModal.jsx`; `useKids` only encrypts `name`). This
feature adds more sensitive data, so the new fields are encrypted, and it's
worth deciding whether to move `birthdate` itself into the encrypted fields
(it would break server-side date queries; none exist today, and nothing in
`functions/` reads `children`).

```
children/{childId}
  + birthTime    (encrypted)  "04:17" | absent
  + birthPlace   (encrypted)  JSON { name, lat, lon, tz }
  + skyStyle     'midnight' | 'kaydo' | 'minimal'
```

For anyone who isn't in `children` (parents, grandparents), use a small
`skyMaps/{id}` collection with the same fields plus an encrypted `personName`.
This way the feature doesn't have to wait for a family tree.

## Implementation phases

| Phase | Scope | Size |
| --- | --- | --- |
| 1 | Astronomy module (pure functions + unit tests against published values: e.g. moon phase and planet altitudes for fixed dates/places), star + constellation data prep script in `scripts/` | M |
| 2 | Canvas renderer with three styles, sky page for a child (entry from `KidJournalCard`), place picker with bundled cities | M |
| 3 | Poster export PNG/PDF with editable caption, post to feed | S |
| 4 | "Sky of this memory" for any memory with date + place; Our Year keepsake integration | S |
| 5 | Optional: weather on the day via Open-Meteo's historical API (free, back to 1940). Off by default: turning it on sends rounded coordinates and a date to a third party, and the toggle says so. | S |

## Accuracy and tests

- Positions to well under a degree are plenty for a poster; `astronomy-engine`
  is far more precise than that.
- Test cases: a known full moon (phase ≈ 180°), the sky over Vienna at a known
  time where Jupiter is known to be up, a southern-hemisphere city (the map
  must mirror correctly), a birth at 00:30 local time (the date shift).
- Visual regression: render three fixed skies to PNG in Vitest (node-canvas or
  jsdom-free pure math on the projected coordinates) and compare point lists,
  not pixels.

## Open questions

1. Should the poster show constellation *names* in German or English? Follow
   the UI language, and let the user override it on the poster.
2. Do we want to offer printed posters (a print-on-demand partner)? That would
   send the image to a third party, so it is opt-in only and out of scope for
   v1.
3. Move `birthdate` to encrypted fields as part of this work, or separately?

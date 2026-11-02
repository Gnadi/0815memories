/**
 * The monthly best-of: a story of a month's photos and clips, put together
 * without anyone choosing them — an opening card, the month in numbers, its
 * themes, its moments in the order they happened (single photos with a camera
 * move, several from one day as an animated collage, the clips), a few awards
 * ("and the place of the month is…") and a last look at what did not make the
 * cut.
 *
 * Nothing here looks at a photo. What makes one photo or one day stand out is
 * what the family said about it: the memory they featured, the album someone
 * wrote a story for, the order its author put the photos in, the place, the
 * day. No image is analysed, on the device or anywhere else — in an app whose
 * point is that the family's pictures are theirs alone, a program judging
 * faces would be the wrong thing to find, even one that never leaves the tab.
 *
 * Everything here is pure. It is handed the month's memories and moments,
 * already decrypted, and returns the story as data. No text is built here:
 * slides carry kinds, layouts and award ids, which the viewer translates, so a
 * best-of made by a German-speaking admin reads in English for everyone else.
 *
 * Deterministic on purpose: every tie is broken by URL, so two devices that
 * build the same month from the same entries arrive at the same story. A viewer
 * who opens a best-of nobody has saved yet sees what an admin would save.
 */
import { thumbAt, tinyPreviewAt } from './mediaThumbs'
import { MOTIONS, styleAt, styleOf } from './bestOfStyle'

export { MOTIONS }

/** Bumped when the composition changes enough that a saved best-of is stale. */
export const BEST_OF_VERSION = 3

/**
 * Fewer photos and clips than this, or no photo among them, and a month has no
 * best-of. Mirrored by familiesWithBestOf in functions/bestOf.js, which
 * decides whether the push goes out; a test keeps the two in step, or a
 * family could be told about a best-of the app then refuses to make.
 */
export const MIN_BEST_OF_MEDIA = 6

// The story's length, roughly what Google Photos shows: long enough to feel
// like the month, short enough to watch to the end. A beat is one entry's
// photos — a single photo, or a collage of up to four.
const MAX_BEATS = 8
const MAX_VIDEOS = 3
const MAX_AWARDS = 3
const EXTRA_PHOTOS = 5
// Fewer than this, and the last look is a photo or two rather than a montage.
const MIN_MONTAGE = 3
const MAX_COLLAGE = 4

// An award has to be earned. A "busiest day" of two photos, or a "place of the
// month" visited once, would only show that there was not much to say.
const MIN_BUSIEST_DAY = 4
const MIN_PLACE_ENTRIES = 2
const MIN_WEEKEND = 4
const MIN_STREAK = 4
const MIN_THEME_ENTRIES = 3

// Every award a month can earn. It shows three at most, and which three goes
// round from month to month (buildBestOf), so a family whose every month has
// a place, a full day and a story does not get the same three each time.
export const AWARDS = ['place', 'busiestDay', 'story', 'weekend', 'streak', 'theme']

// The extra cards (utils/bestOfStyle.js) need a little to say: a calendar of
// two days kept, a "place of the month" list of one place, a month that began
// and ended on the same day.
const MIN_CALENDAR_DAYS = 3
const MIN_RHYTHM_ENTRIES = 5
const RHYTHM_SHARE = 0.5
const MAX_PLACES = 3
const YEAR_AGO_PHOTOS = 3

// ── Months ──────────────────────────────────────────────────────────────────

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/

const pad = (n) => String(n).padStart(2, '0')

/** 'YYYY-MM' for a date, in local time — the month the family lived it in. */
export function monthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

export function isMonthKey(value) {
  return typeof value === 'string' && MONTH_KEY.test(value)
}

/** { year, month } with a 0-based month, or null for anything else. */
export function parseMonthKey(key) {
  const match = typeof key === 'string' ? MONTH_KEY.exec(key) : null
  return match ? { year: Number(match[1]), month: Number(match[2]) - 1 } : null
}

/**
 * The style the best-of of a month is told in (utils/bestOfStyle.js): each
 * month the next one, so no two months in a row look alike.
 */
export function styleForMonth(key) {
  const parsed = parseMonthKey(key)
  return parsed ? styleAt(parsed.year * 12 + parsed.month) : 'classic'
}

/** [start, end) of the month, local time. */
export function monthRange(key) {
  const { year, month } = parseMonthKey(key)
  return [new Date(year, month, 1), new Date(year, month + 1, 1)]
}

/** The first day of the month, for formatting its name. */
export function monthDate(key) {
  return monthRange(key)[0]
}

/**
 * The month whose best-of is current: always the last one that is over. On
 * 1 October that is September, and it stays September until 1 November.
 */
export function currentBestOfMonth(now = new Date()) {
  return monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1))
}

export const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (value && typeof value.toDate === 'function') return value.toDate()
  return null
}

// ── The month's media ───────────────────────────────────────────────────────

function imagesOf(entry) {
  if (Array.isArray(entry.images) && entry.images.length > 0) return entry.images
  return entry.imageUrl ? [entry.imageUrl] : []
}

/**
 * Every photo and clip of the month, flattened, oldest first.
 *
 * Shape: { type: 'image'|'video', url, thumbUrl, tiny, date, day, entryId,
 *          source: 'memory'|'moment', caption, location, themes, featured,
 *          index, photos }
 * `index` is the photo's place in its entry, `photos` how many the entry has.
 */
export function collectMedia({ memories = [], moments = [] }) {
  const seen = new Set()
  const out = []

  const add = (entry, source) => {
    const date = toDate(entry.date)
    if (!date) return
    const caption = (source === 'memory' ? entry.title : entry.caption) || ''
    const location = typeof entry.location === 'string' ? entry.location.trim() : ''
    const themes = [entry.category, entry.label]
      .filter((t) => typeof t === 'string' && t.trim())
      .map((t) => t.trim())
    const images = imagesOf(entry)
    const common = {
      date,
      day: dayKey(date),
      entryId: `${source}:${entry.id}`,
      source,
      caption,
      location,
      themes,
      featured: source === 'memory' && !!entry.featured,
      photos: images.length,
    }
    images.forEach((url, i) => {
      if (!url || seen.has(url)) return
      seen.add(url)
      // A memory without `images` keeps its one photo in `imageUrl`, and its
      // thumbs line up with nothing — thumbAt says so by returning ''.
      out.push({ ...common, type: 'image', url, thumbUrl: thumbAt(entry, i), tiny: tinyPreviewAt(entry, i), index: i })
    })
    ;(Array.isArray(entry.videos) ? entry.videos : []).forEach((video, i) => {
      const url = video?.url
      if (!url || seen.has(url)) return
      seen.add(url)
      out.push({ ...common, type: 'video', url, thumbUrl: '', tiny: '', index: i })
    })
  }

  for (const memory of memories) add(memory, 'memory')
  for (const moment of moments) add(moment, 'moment')

  return out.sort(byDate)
}

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

// The order things happened in; within one entry, the order its author put
// them in, photos before clips.
function byDate(a, b) {
  return a.date - b.date ||
    compare(a.entryId, b.entryId) ||
    compare(a.type, b.type) ||
    a.index - b.index ||
    compare(a.url, b.url)
}

// FNV-1a: a number from a string, the same on every device.
function hashOf(text) {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

// Ties go by URL, but not in its order: a URL carries its upload time
// (Cloudinary's /v<seconds>/), and with weights as coarse as these, URL order
// would hand most of the story to the first days of the month. A hash of it is
// just as stable from device to device and favours no part of the month.
const byUrl = (a, b) => hashOf(a.url) - hashOf(b.url) || compare(a.url, b.url)

export function hasEnoughForBestOf(media) {
  return media.length >= MIN_BEST_OF_MEDIA && media.some((m) => m.type === 'image')
}

/** `count` of `list`, evenly spaced from its first to its last. */
function evenly(list, count) {
  if (list.length <= count) return list
  if (count === 1) return [list[Math.floor(list.length / 2)]]
  return Array.from({ length: count }, (_, i) => list[Math.round((i * (list.length - 1)) / (count - 1))])
}

/**
 * Take `limit` items spread over the month: the first of every entry before
 * the second of any, and within that, one a day, from days evenly spaced
 * through the month. A month with one busy weekend is otherwise all weekend,
 * and one with a clip every day is otherwise all its first week.
 */
function spread(items, limit) {
  const rounds = new Map() // round → day → items
  const perEntry = new Map()
  for (const item of items) {
    const round = perEntry.get(item.entryId) ?? 0
    perEntry.set(item.entryId, round + 1)
    if (!rounds.has(round)) rounds.set(round, new Map())
    const days = rounds.get(round)
    if (!days.has(item.day)) days.set(item.day, [])
    days.get(item.day).push(item)
  }
  const picked = []
  for (const round of [...rounds.keys()].sort((a, b) => a - b)) {
    const queues = [...rounds.get(round).values()]
    while (picked.length < limit && queues.some((q) => q.length)) {
      const waiting = queues.filter((q) => q.length)
      for (const queue of evenly(waiting, limit - picked.length)) picked.push(queue.shift())
    }
  }
  return picked
}

// ── Weight ──────────────────────────────────────────────────────────────────

/**
 * How much a photo stands for the month, from what its entry says about it.
 * The memory the family featured first; then memories, which someone wrote a
 * story for, over moments, which are quick shares; an album over a single
 * snapshot; and within an entry, the photos its author put first.
 */
export function scorePhoto(item) {
  let score = 1
  if (item.featured) score += 1
  if (item.source === 'memory') score += 0.4
  score += 0.05 * Math.min(item.photos ?? 1, 6)
  score -= 0.1 * Math.min(item.index ?? 0, 8)
  return score
}

const byScore = (scores) => (a, b) => scores.get(b.url) - scores.get(a.url) || byUrl(a, b)

// ── Awards ──────────────────────────────────────────────────────────────────

function mostFrequent(values) {
  const counts = new Map()
  const firstSeen = new Map()
  for (const value of values) {
    const key = value.toLocaleLowerCase()
    counts.set(key, (counts.get(key) ?? 0) + 1)
    if (!firstSeen.has(key)) firstSeen.set(key, value)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([key, count]) => ({ value: firstSeen.get(key), key, count }))
}

/** The day after `key` ('YYYY-MM-DD'), as a key. */
function nextDay(key) {
  const [y, m, d] = key.split('-').map(Number)
  return dayKey(new Date(y, m - 1, d + 1))
}

/** The Saturday of the weekend `item` was on, as a key, or null on a weekday. */
function weekendOf(item) {
  const weekday = item.date.getDay()
  if (weekday === 6) return item.day
  if (weekday !== 0) return null
  return dayKey(new Date(item.date.getFullYear(), item.date.getMonth(), item.date.getDate() - 1))
}

/**
 * Each award the month earned, each with a different photo: three at most,
 * tried in `order`, so the first ones in it that the month earned are the
 * ones it gets.
 */
export function chooseAwards(media, scores, order = AWARDS) {
  const photos = media.filter((m) => m.type === 'image')
  const used = new Set()
  const awards = []
  const best = (list) => list.filter((p) => !used.has(p.url)).sort(byScore(scores))[0]

  const earners = {
    // The place of the month: where the most entries were made.
    place() {
      const places = new Map()
      for (const p of media) if (p.location && !places.has(p.entryId)) places.set(p.entryId, p.location)
      const [top] = mostFrequent([...places.values()])
      if (!top || top.count < MIN_PLACE_ENTRIES) return null
      const there = best(photos.filter((p) => p.location.toLocaleLowerCase() === top.key))
      return there && [there, { place: top.value, entries: top.count }]
    },

    // The busiest day: the most photos and clips on one day.
    busiestDay() {
      const [busiest] = mostFrequent(media.map((m) => m.day))
      if (!busiest || busiest.count < MIN_BUSIEST_DAY) return null
      const that = best(photos.filter((p) => p.day === busiest.key))
      const clips = media.filter((m) => m.day === busiest.key && m.type === 'video').length
      return that && [that, { day: busiest.key, count: busiest.count, videos: clips }]
    },

    // The story of the month: the memory marked as featured, or else the one
    // with the most photos — someone thought it worth a whole album.
    story() {
      const memories = new Map()
      for (const p of photos) {
        if (p.source !== 'memory') continue
        if (!memories.has(p.entryId)) memories.set(p.entryId, [])
        memories.get(p.entryId).push(p)
      }
      const [top] = [...memories.values()]
        .map((list) => ({ list, featured: list.some((p) => p.featured) }))
        .filter(({ list, featured }) => featured || list.length >= 3)
        .sort((a, b) => b.featured - a.featured || b.list.length - a.list.length || byUrl(a.list[0], b.list[0]))
      const cover = top && best(top.list)
      return cover && [cover, { caption: cover.caption || '' }]
    },

    // The weekend of the month: the Saturday and Sunday with the most photos
    // and clips.
    weekend() {
      const [top] = mostFrequent(media.map(weekendOf).filter(Boolean))
      if (!top || top.count < MIN_WEEKEND) return null
      const days = new Set([top.key, nextDay(top.key)])
      const that = best(photos.filter((p) => days.has(p.day)))
      return that && [that, { from: top.key, to: nextDay(top.key), count: top.count }]
    },

    // The longest run of days in a row with something kept on every one.
    streak() {
      const days = [...new Set(media.map((m) => m.day))].sort()
      let run = []
      let longest = []
      for (const day of days) {
        run = run.length && nextDay(run[run.length - 1]) === day ? [...run, day] : [day]
        if (run.length > longest.length) longest = run
      }
      if (longest.length < MIN_STREAK) return null
      const inRun = new Set(longest)
      const that = best(photos.filter((p) => inRun.has(p.day)))
      return that && [that, { from: longest[0], to: longest[longest.length - 1], days: longest.length }]
    },

    // The theme of the month: the category or label the most entries had.
    theme() {
      const byEntry = new Map()
      for (const m of media) if (!byEntry.has(m.entryId)) byEntry.set(m.entryId, m)
      const [top] = mostFrequent([...byEntry.values()].flatMap((e) => e.themes))
      if (!top || top.count < MIN_THEME_ENTRIES) return null
      const that = best(photos.filter((p) => p.themes.some((t) => t.toLocaleLowerCase() === top.key)))
      return that && [that, { theme: top.value, entries: top.count }]
    },
  }

  for (const id of order) {
    if (awards.length >= MAX_AWARDS) break
    const earned = earners[id]?.()
    if (!earned) continue
    const [item, detail] = earned
    used.add(item.url)
    awards.push({ award: id, item, detail })
  }
  return awards
}

/** AWARDS, starting from a different one for each month. */
export function awardOrder(month) {
  const parsed = parseMonthKey(month)
  const start = parsed ? (parsed.year * 12 + parsed.month) % AWARDS.length : 0
  return [...AWARDS.slice(start), ...AWARDS.slice(0, start)]
}

// ── The extra cards ─────────────────────────────────────────────────────────

/** The days of the month something was kept on, as day numbers. */
export function chooseCalendar(media) {
  const days = [...new Set(media.map((m) => Number(m.day.slice(8))))].sort((a, b) => a - b)
  return days.length >= MIN_CALENDAR_DAYS ? days : null
}

// When the family shared, from moments that carry a time. A memory's date is
// often only a day, which would read as midnight.
const PARTS_OF_DAY = [[5, 'morning'], [12, 'afternoon'], [17, 'evening'], [22, 'night']]

function partOfDay(date) {
  const hour = date.getHours()
  let part = 'night'
  for (const [from, name] of PARTS_OF_DAY) if (hour >= from) part = name
  return part
}

const hasTime = (date) => date.getHours() || date.getMinutes() || date.getSeconds()

/**
 * What the month's rhythm was, if it had one: a part of the day that half the
 * moments with a time were shared in, or else the weekend, if half of all
 * entries were made on one. { fact, share, item } or null.
 */
export function chooseRhythm(media, scores) {
  const entries = new Map()
  for (const m of media) if (!entries.has(m.entryId)) entries.set(m.entryId, m)
  const all = [...entries.values()]
  const photoOf = (keep) => media.filter((m) => m.type === 'image' && keep(m)).sort(byScore(scores))[0] || null

  const timed = all.filter((e) => e.source === 'moment' && hasTime(e.date))
  if (timed.length >= MIN_RHYTHM_ENTRIES) {
    const [top] = mostFrequent(timed.map((e) => partOfDay(e.date)))
    const share = top.count / timed.length
    if (share >= RHYTHM_SHARE) {
      return { fact: top.value, share, item: photoOf((m) => m.source === 'moment' && hasTime(m.date) && partOfDay(m.date) === top.value) }
    }
  }
  if (all.length >= MIN_RHYTHM_ENTRIES) {
    const weekend = all.filter((e) => weekendOf(e)).length
    const share = weekend / all.length
    // Two days of seven: half of everything on them is a lot.
    if (share >= RHYTHM_SHARE) return { fact: 'weekend', share, item: photoOf((m) => weekendOf(m)) }
  }
  return null
}

/** Up to three places of the month, by how many entries were made there. */
export function choosePlaces(media, scores) {
  const places = new Map()
  for (const p of media) if (p.location && !places.has(p.entryId)) places.set(p.entryId, p.location)
  const top = mostFrequent([...places.values()]).slice(0, MAX_PLACES)
  if (top.length < 2) return null
  const photos = media.filter((m) => m.type === 'image').sort(byScore(scores))
  return top.map(({ value, key, count }) => ({
    place: value,
    entries: count,
    item: photos.find((p) => p.location.toLocaleLowerCase() === key) || null,
  }))
}

/** The month's first and last photo, when they are from different days. */
export function chooseBookends(media) {
  const photos = media.filter((m) => m.type === 'image')
  const [first] = photos
  const last = photos[photos.length - 1]
  return first && last && first.day !== last.day ? [first, last] : null
}

/** 'YYYY-MM' of the same month a year before. */
export function sameMonthLastYear(key) {
  const parsed = parseMonthKey(key)
  return parsed ? `${parsed.year - 1}-${pad(parsed.month + 1)}` : null
}

// ── Themes ──────────────────────────────────────────────────────────────────

/**
 * What the month was about, from the categories and labels the family gave
 * its entries — Google's "Cityscapes, Playgrounds, Trailblazing", told by the
 * people who were there. Places stand in when there are too few of those.
 */
export function chooseThemes(media, scores, limit = 3) {
  const byEntry = new Map()
  for (const m of media) if (!byEntry.has(m.entryId)) byEntry.set(m.entryId, m)
  const entries = [...byEntry.values()]

  let themes = mostFrequent(entries.flatMap((e) => e.themes))
  if (themes.length < 2) themes = mostFrequent(entries.map((e) => e.location).filter(Boolean))
  if (themes.length < 2) return []

  const photos = media.filter((m) => m.type === 'image').sort(byScore(scores))
  const used = new Set()
  return themes.slice(0, limit).map(({ value, key }) => {
    const photo = photos.find((p) =>
      !used.has(p.url) &&
      (p.themes.some((t) => t.toLocaleLowerCase() === key) || p.location.toLocaleLowerCase() === key),
    )
    if (photo) used.add(photo.url)
    return { theme: value, item: photo || null }
  })
}

// ── Beats: the run of the month ─────────────────────────────────────────────

/**
 * The month's moments as beats, oldest first: one per entry, holding its
 * photos the story has not used yet (up to four, in its author's order), and
 * then single photos of the same day pulled together — three quick moments of
 * one Sunday are one collage, not three slides.
 *
 * Entries are taken best first, but spread over the month: it is cut into as
 * many stretches of the calendar as there are beats, and each stretch gives
 * its best entry before any day gives a second. A month with one big holiday
 * still shows its other weeks.
 */
export function chooseBeats(photos, scores, used, limit = MAX_BEATS) {
  const entries = new Map()
  for (const p of photos) {
    if (used.has(p.url)) continue
    if (!entries.has(p.entryId)) entries.set(p.entryId, [])
    entries.get(p.entryId).push(p)
  }
  const ranked = [...entries.values()]
    .map((list) => list.sort((a, b) => a.index - b.index || byUrl(a, b)))
    .map((list) => ({ list, lead: list[0], weight: Math.max(...list.map((p) => scores.get(p.url))) }))
    .sort((a, b) => b.weight - a.weight || byUrl(a.lead, b.lead))

  // Best first, but one stretch of the month at a time, then one day at a
  // time, and only then a second entry of a day already shown.
  const stretchOf = ({ date }) => {
    const length = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    return Math.floor(((date.getDate() - 1) * limit) / length)
  }
  const chosen = []
  const stretches = new Set()
  const days = new Set()
  for (const pass of [0, 1, 2]) {
    for (const entry of ranked) {
      if (chosen.length >= limit) break
      if (chosen.includes(entry)) continue
      if (pass === 0 && stretches.has(stretchOf(entry.lead))) continue
      if (pass === 1 && days.has(entry.lead.day)) continue
      stretches.add(stretchOf(entry.lead))
      days.add(entry.lead.day)
      chosen.push(entry)
    }
  }

  const beats = chosen
    .sort((a, b) => byDate(a.lead, b.lead))
    .map((entry) => entry.list.slice(0, MAX_COLLAGE))

  // Neighbouring snapshots of the same day — entries of one photo each —
  // become one collage. An album is its own beat, whatever is next to it.
  const snapshot = (beat) => beat.length === 1 && beat[0].photos === 1
  const merged = []
  for (const beat of beats) {
    const last = merged[merged.length - 1]
    if (last?.snapshots && snapshot(beat) && last.items[0].day === beat[0].day && last.items.length < MAX_COLLAGE) {
      last.items.push(beat[0])
    } else {
      merged.push({ items: [...beat], snapshots: snapshot(beat) })
    }
  }
  for (const { items } of merged) for (const p of items) used.add(p.url)
  return merged.map(({ items }) => items)
}

// ── The story ───────────────────────────────────────────────────────────────

/** What a slide keeps of a photo: no empty fields, so the document stays small. */
export function slideMedia(item) {
  if (!item) return null
  const media = { url: item.url }
  if (item.thumbUrl) media.thumbUrl = item.thumbUrl
  if (item.tiny) media.tiny = item.tiny
  return media
}

const videoSlide = (item) => ({
  kind: 'video',
  media: { url: item.url },
  caption: item.caption,
  location: item.location,
  day: item.day,
})

/** Split `list` into `parts` runs of near-equal length. */
function split(list, parts) {
  const out = []
  let start = 0
  for (let i = 0; i < parts; i++) {
    const end = Math.round(((i + 1) * list.length) / parts)
    out.push(list.slice(start, end))
    start = end
  }
  return out
}

/** The place that all of `items` share, or '' when they were in several. */
function sharedLocation(items) {
  const [first] = items
  return items.every((p) => p.location === first.location) ? first.location : ''
}

/**
 * The best-of of `month`, or null when there is too little to make one.
 * `lastYear` holds the entries of the same month a year before, for a look
 * back at it; without them there is none.
 *
 * @param {{ month: string, memories: object[], moments: object[],
 *           lastYear?: { memories: object[], moments: object[] } }} input
 */
export function buildBestOf({ month, memories = [], moments = [], lastYear = null }) {
  const media = collectMedia({ memories, moments })
  if (!hasEnoughForBestOf(media)) return null

  const style = styleForMonth(month)
  const { motions: moves, layouts: layoutsBySize, order, features } = styleOf(style)
  const photos = media.filter((m) => m.type === 'image')
  const videos = media.filter((m) => m.type === 'video')
  const scores = new Map(photos.map((p) => [p.url, scorePhoto(p)]))
  const ranked = [...photos].sort(byScore(scores))

  const awards = chooseAwards(media, scores, awardOrder(month))
  const used = new Set(awards.map((a) => a.item.url))

  // The cover leads the opening card and the moments row: the best photo, which
  // an award may well have taken — that is fine, it is the month's face.
  const cover = ranked[0]

  // The month's moments, in the order they happened, with a few clips among
  // them. Single photos and collages take turns at the moves and layouts of
  // the month's style, single photos starting from a different move each
  // month, so that even a style's second outing does not open the same way.
  const beats = chooseBeats(photos, scores, used)
  const clips = spread(videos, MAX_VIDEOS)
  for (const clip of clips) used.add(clip.url)

  const { year = 0, month: monthIndex = 0 } = parseMonthKey(month) || {}
  let motions = year + monthIndex
  const turns = { 2: 0, 3: 0, 4: 0 }
  let lastLayout = null
  const photoSlide = (item, kind = 'photo') => ({
    kind,
    media: slideMedia(item),
    caption: item.caption,
    location: item.location,
    day: item.day,
    motion: moves[motions++ % moves.length],
  })
  const beatSlide = (beat) => {
    if (beat.length === 1) return photoSlide(beat[0])
    // Sizes take their turns apart, and polaroids and strips come in two of
    // them, so a collage of three after one of four could repeat its layout.
    const layouts = layoutsBySize[beat.length]
    let layout = layouts[turns[beat.length]++ % layouts.length]
    if (layout === lastLayout && layouts.length > 1) layout = layouts[turns[beat.length]++ % layouts.length]
    lastLayout = layout
    const entries = new Set(beat.map((p) => p.entryId))
    return {
      kind: 'collage',
      layout,
      media: beat.map(slideMedia),
      // A collage of one entry has its caption; one pulled together from a
      // day's moments has several, and shows the day and place instead.
      caption: entries.size === 1 ? beat[0].caption : '',
      location: sharedLocation(beat),
      day: beat[0].day,
    }
  }

  const sequence = [
    ...beats.map((beat) => ({ at: beat[0], slide: () => beatSlide(beat) })),
    ...clips.map((clip) => ({ at: clip, slide: () => videoSlide(clip) })),
  ].sort((a, b) => byDate(a.at, b.at))

  const themes = chooseThemes(media, scores)
  for (const t of themes) if (t.item) used.add(t.item.url)

  // "And don't forget about…": photos that did not make it, from days the
  // story has not shown yet where there are any.
  const shownDays = new Set(sequence.map((s) => s.at.day))
  const leftover = ranked.filter((p) => !used.has(p.url))
  const extras = [...leftover.filter((p) => !shownDays.has(p.day)), ...leftover.filter((p) => shownDays.has(p.day))]
    .slice(0, EXTRA_PHOTOS)
    .sort(byDate)

  // The cards, each as a list of slides, put in the order of the style below.
  const intro = [{ kind: 'intro', media: ranked.slice(0, 6).map(slideMedia) }]
  const count = [{
    kind: 'count',
    photos: photos.length,
    videos: videos.length,
    media: slideMedia(ranked[1] ?? cover),
  }]
  const themesCard = themes.length
    ? [{ kind: 'themes', themes: themes.map((t) => t.theme), media: themes.map((t) => slideMedia(t.item)) }]
    : []
  const awardSlides = (next) => [
    { kind: 'awardIntro', award: next.award, media: slideMedia(next.item) },
    {
      kind: 'award',
      award: next.award,
      media: slideMedia(next.item),
      caption: next.item.caption,
      location: next.item.location,
      day: next.item.day,
      ...next.detail,
    },
  ]

  // The extra cards of the style, where the month has what they need. Their
  // photos repeat ones the story shows elsewhere, which is fine on a card
  // that sums the month up.
  const wanted = new Set(features)
  const stats = []
  const calendar = wanted.has('calendar') && chooseCalendar(media)
  if (calendar) stats.push({ kind: 'calendar', days: calendar })
  const rhythm = wanted.has('rhythm') && chooseRhythm(media, scores)
  if (rhythm) {
    stats.push({ kind: 'rhythm', fact: rhythm.fact, percent: Math.round(rhythm.share * 100), media: slideMedia(rhythm.item) })
  }
  const places = wanted.has('places') && choosePlaces(media, scores)
  if (places) {
    stats.push({
      kind: 'places',
      places: places.map(({ place, entries }) => ({ place, entries })),
      media: places.map((p) => slideMedia(p.item)),
    })
  }
  const ends = wanted.has('bookends') && chooseBookends(media)
  const bookends = ends
    ? [{ kind: 'bookends', media: ends.map(slideMedia), days: ends.map((p) => p.day), captions: ends.map((p) => p.caption) }]
    : []

  // The same month a year before: a few of its best photos, in the order
  // they were taken.
  const yearAgo = []
  const before = lastYear ? collectMedia(lastYear) : []
  const beforePhotos = before.filter((m) => m.type === 'image')
  if (beforePhotos.length) {
    const beforeScores = new Map(beforePhotos.map((p) => [p.url, scorePhoto(p)]))
    yearAgo.push({
      kind: 'yearAgo',
      month: sameMonthLastYear(month),
      photos: beforePhotos.length,
      videos: before.length - beforePhotos.length,
      media: [...beforePhotos].sort(byScore(beforeScores)).slice(0, YEAR_AGO_PHOTOS).sort(byDate).map(slideMedia),
    })
  }

  // The last look is a montage: the photos one after another in quick cuts,
  // as a recap video ends. With only one or two, the first is the card's own
  // photo and the other follows it.
  let ending = []
  if (extras.length >= MIN_MONTAGE) {
    ending = [{ kind: 'montage', label: 'dontForget', media: extras.map(slideMedia), days: extras.map((p) => p.day) }]
  } else if (extras.length) {
    ending = [photoSlide(extras[0], 'dontForget'), ...extras.slice(1).map((item) => photoSlide(item))]
  }

  // The moments with the awards between their runs, the way an award show
  // breaks for the next category: a run, an award, a run, an award. Made only
  // when it is needed, since every slide made takes its turn at the moves.
  const interleaved = () => split(sequence, awards.length + 1).flatMap((run, i) => [
    ...run.map((step) => step.slide()),
    ...(awards[i] ? awardSlides(awards[i]) : []),
  ])

  let body
  if (order === 'countdown') {
    // Through the moments without a break, the month's other numbers after
    // them, and the awards all together at the end, one after another.
    const moments = sequence.map((step) => step.slide())
    body = [...count, ...themesCard, ...moments, ...stats, ...bookends, ...awards.flatMap(awardSlides)]
  } else if (order === 'numbersLast') {
    // The moments and awards first, the month in numbers at the end.
    body = [...themesCard, ...interleaved(), ...bookends, ...count, ...stats]
  } else {
    body = [...count, ...stats, ...themesCard, ...interleaved(), ...bookends]
  }
  const slides = [...intro, ...body, ...yearAgo, ...ending]

  const closing = [cover, ...beats.flat().filter((p) => p !== cover)].slice(0, 4)
  slides.push({ kind: 'outro', media: closing.map(slideMedia) })

  return {
    version: BEST_OF_VERSION,
    month,
    style,
    cover: slideMedia(cover),
    counts: { photos: photos.length, videos: videos.length },
    awards: awards.map((a) => a.award),
    slides,
  }
}

/** Every encrypted URL a slide shows, for warming the decrypt cache. */
export function slideUrls(slide) {
  if (!slide) return []
  const list = Array.isArray(slide.media) ? slide.media : [slide.media]
  return list.filter(Boolean).map((m) => ({ url: m.thumbUrl || m.url, video: slide.kind === 'video' }))
}

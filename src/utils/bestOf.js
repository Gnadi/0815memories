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

/** Bumped when the composition changes enough that a saved best-of is stale. */
export const BEST_OF_VERSION = 1

/**
 * Fewer photos and clips than this, and a month has no best-of. Mirrored by
 * BEST_OF_MIN_MEDIA in functions/bestOf.js, which decides whether the push goes
 * out; a test keeps the two equal, or a family could be told about a best-of
 * the app then refuses to make.
 */
export const MIN_BEST_OF_MEDIA = 6

// The story's length, roughly what Google Photos shows: long enough to feel
// like the month, short enough to watch to the end. A beat is one entry's
// photos — a single photo, or a collage of up to four.
const MAX_BEATS = 8
const MAX_VIDEOS = 3
const MAX_AWARDS = 3
const EXTRA_PHOTOS = 3
const MAX_COLLAGE = 4

// An award has to be earned. A "busiest day" of two photos, or a "place of the
// month" visited once, would only show that there was not much to say.
const MIN_BUSIEST_DAY = 4
const MIN_PLACE_ENTRIES = 2

export const AWARDS = ['place', 'busiestDay', 'story']

// How a single photo moves, in turn, so no two in a row move the same way.
export const MOTIONS = ['zoomIn', 'panLeft', 'zoomOut', 'panRight', 'panUp']

// Which collage a beat of so many photos becomes, in turn: three photos are
// a trio, then polaroids, then a film strip, and round again.
const LAYOUTS = {
  2: ['duo'],
  3: ['trio', 'polaroids', 'strip'],
  4: ['grid', 'polaroids', 'strip'],
}

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

const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

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

const byUrl = (a, b) => compare(a.url, b.url)

export function hasEnoughForBestOf(media) {
  return media.length >= MIN_BEST_OF_MEDIA && media.some((m) => m.type === 'image')
}

/**
 * Take `limit` items spread over the month: the first of every entry before
 * the second of any, and within that, days in turn. A month with one busy
 * weekend is otherwise all weekend.
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
      for (const queue of queues) {
        if (picked.length >= limit) break
        const next = queue.shift()
        if (next) picked.push(next)
      }
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

/** Each award the month earned, each with a different photo. */
export function chooseAwards(media, scores) {
  const photos = media.filter((m) => m.type === 'image')
  const used = new Set()
  const awards = []
  const free = (list) => list.filter((p) => !used.has(p.url))
  const award = (id, item, detail = {}) => {
    if (!item || awards.length >= MAX_AWARDS) return
    used.add(item.url)
    awards.push({ award: id, item, detail })
  }

  // The place of the month: where the most entries were made.
  const places = new Map()
  for (const p of media) if (p.location && !places.has(p.entryId)) places.set(p.entryId, p.location)
  const [topPlace] = mostFrequent([...places.values()])
  if (topPlace && topPlace.count >= MIN_PLACE_ENTRIES) {
    const there = free(photos)
      .filter((p) => p.location.toLocaleLowerCase() === topPlace.key)
      .sort(byScore(scores))
    award('place', there[0], { place: topPlace.value, entries: topPlace.count })
  }

  // The busiest day: the most photos and clips on one day.
  const [busiest] = mostFrequent(media.map((m) => m.day))
  if (busiest && busiest.count >= MIN_BUSIEST_DAY) {
    const that = free(photos).filter((p) => p.day === busiest.key).sort(byScore(scores))
    const clips = media.filter((m) => m.day === busiest.key && m.type === 'video').length
    award('busiestDay', that[0], { day: busiest.key, count: busiest.count, videos: clips })
  }

  // The story of the month: the memory marked as featured, or else the one
  // with the most photos — someone thought it worth a whole album.
  const memories = new Map()
  for (const p of photos) {
    if (p.source !== 'memory') continue
    if (!memories.has(p.entryId)) memories.set(p.entryId, [])
    memories.get(p.entryId).push(p)
  }
  const stories = [...memories.values()]
    .map((list) => ({ list, featured: list.some((p) => p.featured) }))
    .filter(({ list, featured }) => featured || list.length >= 3)
    .sort((a, b) => b.featured - a.featured || b.list.length - a.list.length || byUrl(a.list[0], b.list[0]))
  if (stories[0]) {
    const [cover] = free(stories[0].list).sort(byScore(scores))
    award('story', cover, { caption: cover?.caption || '' })
  }

  return awards
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
 * Entries are taken best first and spread over the days, so a month with one
 * big holiday still shows its other weeks.
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

  // Best first, but no day twice until every day has had a turn.
  const chosen = []
  const days = new Set()
  for (const pass of [0, 1]) {
    for (const entry of ranked) {
      if (chosen.length >= limit) break
      if (chosen.includes(entry)) continue
      if (pass === 0 && days.has(entry.lead.day)) continue
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
 *
 * @param {{ month: string, memories: object[], moments: object[] }} input
 */
export function buildBestOf({ month, memories = [], moments = [] }) {
  const media = collectMedia({ memories, moments })
  if (!hasEnoughForBestOf(media)) return null

  const photos = media.filter((m) => m.type === 'image')
  const videos = media.filter((m) => m.type === 'video')
  const scores = new Map(photos.map((p) => [p.url, scorePhoto(p)]))
  const ranked = [...photos].sort(byScore(scores))

  const awards = chooseAwards(media, scores)
  const used = new Set(awards.map((a) => a.item.url))

  // The cover leads the opening card and the moments row: the best photo, which
  // an award may well have taken — that is fine, it is the month's face.
  const cover = ranked[0]

  // The month's moments, in the order they happened, with a few clips among
  // them. Single photos and collages take turns at their moves and layouts.
  const beats = chooseBeats(photos, scores, used)
  const clips = spread(videos, MAX_VIDEOS)
  for (const clip of clips) used.add(clip.url)

  let motions = 0
  const turns = { 2: 0, 3: 0, 4: 0 }
  const photoSlide = (item, kind = 'photo') => ({
    kind,
    media: slideMedia(item),
    caption: item.caption,
    location: item.location,
    day: item.day,
    motion: MOTIONS[motions++ % MOTIONS.length],
  })
  const beatSlide = (beat) => {
    if (beat.length === 1) return photoSlide(beat[0])
    const layouts = LAYOUTS[beat.length]
    const entries = new Set(beat.map((p) => p.entryId))
    return {
      kind: 'collage',
      layout: layouts[turns[beat.length]++ % layouts.length],
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

  // "And don't forget about…": photos that did not make it, from days the
  // story has not shown yet where there are any.
  const shownDays = new Set(sequence.map((s) => s.at.day))
  const leftover = ranked.filter((p) => !used.has(p.url))
  const extras = [...leftover.filter((p) => !shownDays.has(p.day)), ...leftover.filter((p) => shownDays.has(p.day))]
    .slice(0, EXTRA_PHOTOS)
    .sort(byDate)

  const slides = [
    // The opening card's floating photos: the best few, whatever else they are.
    { kind: 'intro', media: ranked.slice(0, 6).map(slideMedia) },
    {
      kind: 'count',
      photos: photos.length,
      videos: videos.length,
      media: slideMedia(ranked[1] ?? cover),
    },
  ]
  if (themes.length) {
    slides.push({ kind: 'themes', themes: themes.map((t) => t.theme), media: themes.map((t) => slideMedia(t.item)) })
  }

  // Awards between the runs of moments, the way an award show breaks for the
  // next category: a run, an award, a run, an award.
  split(sequence, awards.length + 1).forEach((run, i) => {
    for (const step of run) slides.push(step.slide())
    const next = awards[i]
    if (next) {
      slides.push({ kind: 'awardIntro', award: next.award, media: slideMedia(next.item) })
      slides.push({
        kind: 'award',
        award: next.award,
        media: slideMedia(next.item),
        caption: next.item.caption,
        location: next.item.location,
        day: next.item.day,
        ...next.detail,
      })
    }
  })

  // The first of them is the card's own photo; the rest follow it.
  if (extras.length) {
    slides.push(photoSlide(extras[0], 'dontForget'))
    for (const item of extras.slice(1)) slides.push(photoSlide(item))
  }

  const closing = [cover, ...beats.flat().filter((p) => p !== cover)].slice(0, 4)
  slides.push({ kind: 'outro', media: closing.map(slideMedia) })

  return {
    version: BEST_OF_VERSION,
    month,
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

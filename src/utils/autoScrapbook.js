// Automatic scrapbooks: turn a month, or a hand-picked set of memories and
// moments, into a finished book — a cover plus laid-out pages with every photo
// already in its slot — so the editor opens on something to tweak rather than
// on a blank page.
//
// Everything here is pure: no Firestore, no React, no user-facing strings
// beyond what the caller hands in. Page geometry matches ScrapbookCanvas
// (800 × 600) and the element schema of layoutPresets.js.

import { LAYOUT_PRESETS } from '../components/scrapbook/layoutPresets'
import { thumbAt } from './mediaThumbs'

export const COVER_SCHEMES = [
  // Light backgrounds → dark titles
  { bg: '#FDF6EC', titleColor: '#2D1B0E', accentColor: '#C25A2E' }, // cream + bark + kaydo
  { bg: '#FBCFE8', titleColor: '#4A1942', accentColor: '#7B3F6E' }, // blush + dark purple + mauve
  { bg: '#EFF6FF', titleColor: '#1E3A5F', accentColor: '#3B5E8A' }, // ice blue + navy + blue
  { bg: '#F0FFF4', titleColor: '#1B4332', accentColor: '#4A7C59' }, // mint + dark forest + green
  { bg: '#FAF5FF', titleColor: '#3B0764', accentColor: '#7B3F6E' }, // lavender + deep violet + mauve
  { bg: '#FEFCE8', titleColor: '#451A03', accentColor: '#C25A2E' }, // warm yellow + dark brown + orange
  { bg: '#FFF5F5', titleColor: '#7F1D1D', accentColor: '#C25A2E' }, // blush white + dark red + orange
  // Dark backgrounds → light titles
  { bg: '#2D1B0E', titleColor: '#FFFDF9', accentColor: '#D4784A' }, // dark bark + white + light orange
  { bg: '#3B5E8A', titleColor: '#FFFDF9', accentColor: '#BFDBFE' }, // dark blue + white + sky
  { bg: '#C25A2E', titleColor: '#FFFDF9', accentColor: '#FEFCE8' }, // kaydo orange + white + pale yellow
  { bg: '#4A7C59', titleColor: '#FFFDF9', accentColor: '#DCFCE7' }, // forest green + white + mint
  { bg: '#7B3F6E', titleColor: '#FFFDF9', accentColor: '#FBCFE8' }, // mauve + white + blush
]

// Interior pages stay light so the dark caption text always reads.
const PAGE_BACKGROUNDS = ['#FFFDF9', '#FDF6EC', '#F5E6D0', '#FFF5F5', '#EFF6FF', '#F0FFF4', '#FAF5FF', '#FEFCE8']
const CAPTION_COLOR = '#2D1B0E'

// A month needs this many photos before it is worth suggesting as a book.
export const MIN_SUGGESTION_PHOTOS = 4
const MAX_SUGGESTIONS = 6
// One entry never takes over the book: its first photos tell the story.
const MAX_PHOTOS_PER_ENTRY = 12
// Single-photo entries are gathered onto shared polaroid pages, this many each.
const SINGLES_PER_PAGE = 4
// Keeps the encrypted `pages` blob comfortably under Firestore's document cap.
export const MAX_PAGES = 40

const uid = () => crypto.randomUUID()

function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (value && typeof value.toDate === 'function') return value.toDate()
  if (value && typeof value.seconds === 'number') return new Date(value.seconds * 1000)
  return null
}

/**
 * Memories and moments, flattened to one shape the builder understands.
 * Entries without a photo are left out — a scrapbook page is photos first.
 *
 * Shape: [{ id, kind: 'memory' | 'moment', title, date, photos: [{ url, thumbUrl }] }]
 * sorted oldest → newest, the order a book reads in.
 */
export function collectEntries(memories = [], moments = []) {
  const out = []
  const add = (doc, kind, title) => {
    const urls = Array.isArray(doc.images) && doc.images.length > 0
      ? doc.images
      : (doc.imageUrl ? [doc.imageUrl] : [])
    const photos = urls
      .map((url, i) => ({ url, thumbUrl: thumbAt(doc, i) || '' }))
      .filter((p) => typeof p.url === 'string' && p.url)
    if (photos.length === 0) return
    out.push({ id: `${kind}:${doc.id}`, kind, title: (title || '').trim(), date: toDate(doc.date), photos })
  }
  for (const m of memories) add(m, 'memory', m.title)
  for (const m of moments) add(m, 'moment', m.caption || m.label)
  return out.sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0))
}

export function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function entriesInMonth(entries, year, month) {
  return entries.filter((e) => e.date && e.date.getFullYear() === year && e.date.getMonth() === month)
}

const photoCount = (entries) => entries.reduce((n, e) => n + e.photos.length, 0)

/**
 * "Make a book about…" — the months worth a scrapbook, newest first.
 *
 * Every month with enough photos qualifies; the newest ones are what people
 * want to look back on, so those lead. The busiest month on record — usually a
 * holiday — is always kept even when it is older than the rest.
 *
 * Shape: [{ id, year, month, entryCount, photoCount, preview: [photo], busiest }]
 */
export function suggestMonths(entries) {
  const byMonth = new Map()
  for (const e of entries) {
    if (!e.date) continue
    const key = monthKey(e.date)
    if (!byMonth.has(key)) byMonth.set(key, [])
    byMonth.get(key).push(e)
  }

  const months = [...byMonth.entries()]
    .map(([key, list]) => {
      const [year, month] = key.split('-').map(Number)
      return {
        id: `month-${key}`,
        year,
        month: month - 1,
        entryCount: list.length,
        photoCount: photoCount(list),
        preview: list.flatMap((e) => e.photos).slice(0, 3),
        busiest: false,
      }
    })
    .filter((m) => m.photoCount >= MIN_SUGGESTION_PHOTOS)
    .sort((a, b) => (b.year - a.year) || (b.month - a.month))

  if (months.length === 0) return []

  const busiest = months.reduce((best, m) => (m.photoCount > best.photoCount ? m : best), months[0])
  const picked = months.slice(0, MAX_SUGGESTIONS)
  if (!picked.includes(busiest)) picked[picked.length - 1] = busiest
  return picked.map((m) => (m === busiest ? { ...m, busiest: true } : m))
}

// ─── Page building ───────────────────────────────────────────────────────────

const photo = (url, x, y, width, height, zIndex, extra = {}) => ({
  id: uid(),
  type: 'photo',
  isSlot: false,
  url,
  x, y, width, height,
  rotation: 0,
  zIndex,
  imageScale: 1,
  ...extra,
})

const caption = (text, { x = 40, y = 500, width = 720, height = 70, fontSize = 30, zIndex = 20 } = {}) => ({
  id: uid(),
  type: 'text',
  text,
  x, y, width, height,
  rotation: 0,
  zIndex,
  fontSize,
  fontFamily: 'serif',
  fontWeight: 'normal',
  color: CAPTION_COLOR,
  textAlign: 'center',
})

// Photo frames per photo count, each leaving the bottom band free for a caption.
const FRAMES = {
  1: [[40, 30, 720, 450]],
  2: [[30, 30, 365, 450], [405, 30, 365, 450]],
  3: [[30, 30, 440, 450], [480, 30, 290, 220], [480, 260, 290, 220]],
  4: [[30, 30, 365, 220], [405, 30, 365, 220], [30, 260, 365, 220], [405, 260, 365, 220]],
  5: [[30, 30, 365, 220], [405, 30, 365, 220], [30, 260, 240, 220], [280, 260, 240, 220], [530, 260, 240, 220]],
  6: [[30, 30, 240, 220], [280, 30, 240, 220], [530, 30, 240, 220], [30, 260, 240, 220], [280, 260, 240, 220], [530, 260, 240, 220]],
}

// Polaroids for gathered single-photo entries, slightly tilted like a real page.
const SCATTER = {
  1: [[200, 50, 400, 480, -3]],
  2: [[70, 70, 320, 420, -5], [410, 60, 320, 420, 4]],
  3: [[40, 90, 250, 330, -6], [280, 50, 250, 330, 3], [520, 100, 250, 330, -2]],
  4: [[60, 20, 300, 270, -5], [440, 30, 300, 270, 4], [90, 310, 300, 270, 3], [410, 300, 300, 270, -4]],
}

function chunk(list, size) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

function truncate(text, max) {
  if (!text || text.length <= max) return text || ''
  return `${text.slice(0, max - 1).trimEnd()}…`
}

function entryPages(entry, formatDate, background) {
  const photos = entry.photos.slice(0, MAX_PHOTOS_PER_ENTRY)
  // Split evenly rather than 6 + 1, so no page is left with one lonely photo.
  const pageCount = Math.ceil(photos.length / 6)
  const perPage = Math.ceil(photos.length / pageCount)
  const label = [entry.title, entry.date ? formatDate(entry.date) : ''].filter(Boolean).join(' · ')

  return chunk(photos, perPage).map((group, pageIndex) => {
    const frames = FRAMES[group.length]
    const elements = group.map((p, i) => photo(p.url, ...frames[i], i + 1))
    if (label && pageIndex === 0) elements.push(caption(truncate(label, 90)))
    return { id: uid(), backgroundColor: background(), backgroundPattern: 'none', elements, customizable: false }
  })
}

function singlesPage(entries, formatDate, background) {
  const spots = SCATTER[entries.length]
  const elements = entries.map((entry, i) => {
    const [x, y, width, height, rotation] = spots[i]
    const text = entry.title || (entry.date ? formatDate(entry.date) : '')
    return photo(entry.photos[0].url, x, y, width, height, i + 1, {
      rotation,
      polaroid: true,
      ...(text ? { caption: truncate(text, 40) } : {}),
    })
  })
  return { id: uid(), backgroundColor: background(), backgroundPattern: 'none', elements, customizable: false }
}

function titleFontSize(title) {
  // Anton is narrow — roughly half an em per capital — so this keeps a long
  // title on one line across the 800px cover without shrinking short ones.
  const len = Math.max(title.length, 1)
  return Math.max(56, Math.min(140, Math.floor(1500 / len)))
}

function coverPage({ title, subtitle, coverPhoto, scheme }) {
  const preset = LAYOUT_PRESETS.find((p) => p.id === 'cover-magazine')
  const upper = (title || '').toUpperCase()
  const elements = preset.elements.map((el) => {
    if (el.type === 'photo') {
      return coverPhoto
        ? { ...el, id: uid(), url: coverPhoto.url, isSlot: false, imageScale: 1 }
        : { ...el, id: uid() }
    }
    const isSubtitle = el.text === '2025'
    return {
      ...el,
      id: uid(),
      text: isSubtitle ? subtitle : upper,
      color: isSubtitle ? scheme.accentColor : scheme.titleColor,
      ...(isSubtitle ? {} : { fontSize: titleFontSize(upper) }),
    }
  })
  return { id: uid(), backgroundColor: scheme.bg, backgroundPattern: 'none', elements, customizable: false }
}

/**
 * The whole book for a list of entries: a cover, then the entries in date
 * order. Entries with several photos get a page of their own with a caption;
 * runs of single-photo entries (typically moments) share polaroid pages so a
 * month of snapshots doesn't become thirty near-empty pages.
 *
 * Returns { pages, coverImageUrl } ready for addScrapbook.
 */
export function buildScrapbook(entries, {
  title,
  subtitle = '',
  formatDate = (d) => d.toLocaleDateString(),
  random = Math.random,
} = {}) {
  const sorted = [...entries].sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0))
  const scheme = COVER_SCHEMES[Math.floor(random() * COVER_SCHEMES.length)]

  let bgIndex = Math.floor(random() * PAGE_BACKGROUNDS.length)
  const background = () => PAGE_BACKGROUNDS[bgIndex++ % PAGE_BACKGROUNDS.length]

  // The cover shows the entry with the most photos — usually the big day.
  const hero = sorted.reduce((best, e) => (!best || e.photos.length > best.photos.length ? e : best), null)
  const coverPhoto = hero?.photos[0] || null

  const pages = [coverPage({ title, subtitle, coverPhoto, scheme })]
  let singles = []
  const flushSingles = () => {
    for (const group of chunk(singles, SINGLES_PER_PAGE)) pages.push(singlesPage(group, formatDate, background))
    singles = []
  }

  for (const entry of sorted) {
    if (entry.photos.length === 1) {
      singles.push(entry)
      continue
    }
    flushSingles()
    pages.push(...entryPages(entry, formatDate, background))
  }
  flushSingles()

  return { pages: pages.slice(0, MAX_PAGES), coverImageUrl: coverPhoto?.url || null }
}

/** "2024" or "2023 – 2024" for the cover of a hand-picked book. */
export function yearSpan(entries) {
  const years = entries.map((e) => e.date?.getFullYear()).filter(Boolean)
  if (years.length === 0) return String(new Date().getFullYear())
  const min = Math.min(...years)
  const max = Math.max(...years)
  return min === max ? String(min) : `${min} – ${max}`
}

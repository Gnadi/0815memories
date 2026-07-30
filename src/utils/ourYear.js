/**
 * "Our Year" — pure logic for the couple's recurring review ritual.
 *
 * Deliberately free of Firebase imports so every rule here can be unit-tested
 * (see src/__tests__/ourYear.test.js). Anything that talks to Firestore lives
 * in src/hooks/useOurYear.js.
 *
 * Vocabulary note: a *ritual* is the couple's setup (who, which occasion, which
 * rhythm). A *chapter* is one review covering a self-chosen period. Nothing in
 * here assumes marriage, children, or a twelve-month cadence.
 */

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** Firestore Timestamp | Date | ISO string | epoch ms → Date (or null). */
export function toDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function startOfDay(date) {
  const d = toDate(date) ?? new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

const DAY_MS = 24 * 60 * 60 * 1000

export function daysBetween(start, end) {
  const a = startOfDay(start)
  const b = startOfDay(end)
  return Math.round((b - a) / DAY_MS)
}

export function addDays(date, days) {
  const d = startOfDay(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * The anchor day inside a given year. Clamps to the last day of the month so a
 * 29 February anniversary lands on 28 February in common years instead of
 * silently rolling into March.
 *
 * @param {number} year
 * @param {number} month 1-12
 * @param {number} day 1-31
 */
export function anchorDateInYear(year, month, day) {
  const daysInMonth = new Date(year, month, 0).getDate()
  return new Date(year, month - 1, Math.min(day, daysInMonth))
}

function hasAnchor(ritual) {
  return !!ritual && ritual.rhythm === 'recurring' && !!ritual.anchorMonth && !!ritual.anchorDay
}

/** The next occurrence of the couple's chosen day, today included. Null when the ritual has no fixed date. */
export function nextRitualDate(ritual, now = new Date()) {
  if (!hasAnchor(ritual)) return null
  const today = startOfDay(now)
  const thisYear = anchorDateInYear(today.getFullYear(), ritual.anchorMonth, ritual.anchorDay)
  if (thisYear >= today) return thisYear
  return anchorDateInYear(today.getFullYear() + 1, ritual.anchorMonth, ritual.anchorDay)
}

/** The most recent occurrence of the chosen day, today included. */
export function previousRitualDate(ritual, now = new Date()) {
  if (!hasAnchor(ritual)) return null
  const today = startOfDay(now)
  const thisYear = anchorDateInYear(today.getFullYear(), ritual.anchorMonth, ritual.anchorDay)
  if (thisYear <= today) return thisYear
  return anchorDateInYear(today.getFullYear() - 1, ritual.anchorMonth, ritual.anchorDay)
}

/** Days until the next occasion. Null without a fixed date. */
export function daysUntilRitual(ritual, now = new Date()) {
  const next = nextRitualDate(ritual, now)
  return next ? daysBetween(now, next) : null
}

// ---------------------------------------------------------------------------
// Chapters
// ---------------------------------------------------------------------------

/** How long a chapter spans — decides whether copy says "this year" or "this time together". */
export function periodKind(periodStart, periodEnd) {
  const start = toDate(periodStart)
  const end = toDate(periodEnd)
  if (!start || !end) return 'span'
  const days = daysBetween(start, end)
  return days >= 320 && days <= 400 ? 'year' : 'span'
}

/** The open chapter, if the couple has one in progress. */
export function findOpenChapter(chapters = []) {
  return chapters.find((c) => c.status !== 'closed') ?? null
}

/** Chapters newest first, by the period they cover. */
export function sortChapters(chapters = []) {
  return [...chapters].sort((a, b) => {
    const bs = toDate(b.periodStart)?.getTime() ?? 0
    const as = toDate(a.periodStart)?.getTime() ?? 0
    return bs - as
  })
}

/**
 * A starting point for the next chapter's period — never a constraint. The
 * couple can move both ends freely in the "new chapter" dialog.
 *
 * end   — the upcoming occasion when it is close (≤ 30 days out), otherwise today.
 * start — the day after the previous chapter ended, otherwise one year before `end`.
 */
export function suggestChapterPeriod(ritual, chapters = [], now = new Date()) {
  const today = startOfDay(now)

  let end = today
  const next = nextRitualDate(ritual, now)
  if (next && daysBetween(today, next) <= 30) end = next

  const previous = sortChapters(chapters.filter((c) => toDate(c.periodEnd)))[0]
  let start
  if (previous) {
    start = addDays(toDate(previous.periodEnd), 1)
  } else {
    start = new Date(end.getFullYear() - 1, end.getMonth(), end.getDate())
  }

  // A nudged period must never come out backwards (e.g. a chapter that already
  // reaches into the future because the couple looked ahead last time).
  if (start > end) start = new Date(end.getFullYear() - 1, end.getMonth(), end.getDate())

  return { start, end }
}

/**
 * An automatic chapter title as an i18n key plus values — the caller
 * translates, so the suggestion follows the interface language.
 *
 * @returns {{ key: string, values: object }}
 */
export function suggestChapterTitle(periodStart, periodEnd, chapterCount = 0) {
  const start = toDate(periodStart)
  const end = toDate(periodEnd)
  if (!start || !end) return { key: 'chapter.autoTitleFallback', values: { count: chapterCount + 1 } }

  if (periodKind(start, end) === 'year') {
    if (start.getFullYear() === end.getFullYear()) {
      return { key: 'chapter.autoTitleYear', values: { year: end.getFullYear() } }
    }
    return {
      key: 'chapter.autoTitleYearSpan',
      values: { from: start.getFullYear(), to: end.getFullYear() },
    }
  }
  return { key: 'chapter.autoTitleFallback', values: { count: chapterCount + 1 } }
}

/** Formats a single day for display, e.g. "12. Mai 2026". */
export function formatDay(value, locale = 'de') {
  const d = toDate(value)
  if (!d) return ''
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Formats a day without its year — for a date that recurs every year. */
export function formatDayOfYear(month, day, locale = 'de') {
  if (!month || !day) return ''
  return anchorDateInYear(2024, month, day).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
  })
}

/** The name a couple chose for one of them. Empty when they didn't give one. */
export function participantName(ritual, uid) {
  const entry = (ritual?.partners ?? []).find((p) => p?.uid === uid)
  return entry?.name?.trim() ?? ''
}

/**
 * What the couple calls their occasion. A wording like "wedding anniversary"
 * only ever appears because they picked it themselves.
 *
 * @param {object} ritual
 * @param {function} t — the `ourYear` translator
 */
export function occasionLabelFor(ritual, t) {
  if (!ritual) return ''
  if (ritual.occasionKey === 'custom') {
    return ritual.occasionLabel?.trim() || t('occasions.custom')
  }
  return t(`occasions.${ritual.occasionKey ?? 'personal'}`)
}

/** The other person's uid, from the ritual or from a chapter. */
export function partnerUidOf(source, uid) {
  return (source?.participantUids ?? []).find((u) => u !== uid) ?? null
}

/** Formats a chapter's period for display, e.g. "Mai 2025 – Mai 2026". */
export function formatPeriod(periodStart, periodEnd, locale = 'de') {
  const start = toDate(periodStart)
  const end = toDate(periodEnd)
  if (!start || !end) return ''
  const opts = { month: 'long', year: 'numeric' }
  const from = start.toLocaleDateString(locale, opts)
  const to = end.toLocaleDateString(locale, opts)
  return from === to ? from : `${from} – ${to}`
}

// ---------------------------------------------------------------------------
// The five reflection questions (fixed) and the quiz pool (per chapter)
// ---------------------------------------------------------------------------

export const REFLECTION_QUESTION_IDS = ['moment', 'laugh', 'mastered', 'more', 'grateful']

/**
 * Quiz suggestions. `kids` is intentionally *not* part of the default set —
 * the ritual must not assume a particular way of living. It stays available in
 * the suggestion pool for couples it fits.
 */
export const QUIZ_SUGGESTION_IDS = [
  'trip',
  'phrase',
  'purchase',
  'pointlessDebate',
  'laughedHardest',
  'kids',
  'surprise',
  'meal',
  'hardestDay',
  'proudest',
]

export const DEFAULT_QUIZ_QUESTION_IDS = ['trip', 'phrase', 'purchase', 'pointlessDebate', 'surprise']

/** The question set a new chapter starts with. Fully editable afterwards. */
export function defaultQuizQuestions() {
  return DEFAULT_QUIZ_QUESTION_IDS.map((presetKey) => ({ id: presetKey, presetKey }))
}

/** Stable id for a question the couple wrote themselves. */
export function newQuestionId() {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/** Joint reactions a couple can optionally record per quiz question. */
export const QUIZ_REACTIONS = ['same', 'different', 'forgotten', 'talk']

// ---------------------------------------------------------------------------
// The sealed letter
// ---------------------------------------------------------------------------

/**
 * 'none'    — not written yet
 * 'draft'   — being written, both can still edit
 * 'sealed'  — closed, open date still in the future
 * 'waiting' — may be opened now ("A letter from us is waiting for us.")
 * 'opened'  — read, stays with the chapter forever
 */
export function letterState(chapter, now = new Date()) {
  if (!chapter) return 'none'
  const status = chapter.letterStatus ?? 'none'
  if (status !== 'sealed') return status
  const openAt = toDate(chapter.letterOpenAt)
  if (!openAt) return 'sealed'
  return openAt.getTime() <= now.getTime() ? 'waiting' : 'sealed'
}

/** True while Firestore will refuse to hand out the letter body. */
export function isLetterLocked(chapter, now = new Date()) {
  return letterState(chapter, now) === 'sealed'
}

/** Default open date offered when sealing: the next occasion, else a year out. */
export function suggestLetterOpenDate(ritual, now = new Date()) {
  const next = nextRitualDate(ritual, now)
  if (next && daysBetween(now, next) >= 30) return next
  if (next) return anchorDateInYear(next.getFullYear() + 1, ritual.anchorMonth, ritual.anchorDay)
  const today = startOfDay(now)
  return new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
}

// ---------------------------------------------------------------------------
// The four keepsakes
// ---------------------------------------------------------------------------

export const KEEPSAKE_SLOTS = ['photo', 'song', 'quote', 'moment']

export function emptyKeepsakes() {
  return {
    photoUrl: '',
    photoPublicId: '',
    song: { title: '', artist: '', link: '' },
    quote: '',
    moment: '',
  }
}

export function isKeepsakeFilled(keepsakes, slot) {
  const k = keepsakes ?? {}
  switch (slot) {
    case 'photo':
      return !!k.photoUrl
    case 'song':
      return !!k.song?.title?.trim()
    case 'quote':
      return !!k.quote?.trim()
    case 'moment':
      return !!k.moment?.trim()
    default:
      return false
  }
}

export function keepsakesFilledCount(keepsakes) {
  return KEEPSAKE_SLOTS.filter((slot) => isKeepsakeFilled(keepsakes, slot)).length
}

export function keepsakesComplete(keepsakes) {
  return keepsakesFilledCount(keepsakes) === KEEPSAKE_SLOTS.length
}

// ---------------------------------------------------------------------------
// Progress and closing
// ---------------------------------------------------------------------------

/** Did this person already hand in their part? */
export function hasSubmitted(chapter, kind, uid) {
  const list = chapter?.[kind === 'quiz' ? 'quizSubmittedBy' : 'reflectionSubmittedBy'] ?? []
  return list.includes(uid)
}

/** Are both sides in, so the answers may be shown together? */
export function isRevealed(chapter, kind) {
  return !!chapter?.[kind === 'quiz' ? 'quizRevealedAt' : 'reflectionsRevealedAt']
}

/** True once both participants submitted — the moment the reveal is written. */
export function bothSubmitted(chapter, kind) {
  const list = chapter?.[kind === 'quiz' ? 'quizSubmittedBy' : 'reflectionSubmittedBy'] ?? []
  const participants = chapter?.participantUids ?? []
  return participants.length > 0 && participants.every((uid) => list.includes(uid))
}

/**
 * Per-step state for the chapter rail.
 * 'todo' | 'partial' | 'waiting' (you are done, your partner isn't) | 'done'
 */
export function chapterProgress(chapter, uid, now = new Date()) {
  const stepFor = (kind) => {
    if (isRevealed(chapter, kind)) return 'done'
    return hasSubmitted(chapter, kind, uid) ? 'waiting' : 'todo'
  }

  const letter = letterState(chapter, now)
  const filled = keepsakesFilledCount(chapter?.keepsakes)

  return {
    reflection: stepFor('reflection'),
    quiz: stepFor('quiz'),
    letter: letter === 'none' || letter === 'draft' ? 'todo' : 'done',
    keepsakes: filled === KEEPSAKE_SLOTS.length ? 'done' : filled > 0 ? 'partial' : 'todo',
  }
}

/**
 * A chapter can be closed together once both reviews are shared, the letter is
 * sealed and all four keepsakes are held.
 *
 * @returns {{ ready: boolean, missing: string[] }}
 */
export function canCloseChapter(chapter, now = new Date()) {
  const missing = []
  if (!isRevealed(chapter, 'reflection')) missing.push('reflection')
  if (!isRevealed(chapter, 'quiz')) missing.push('quiz')
  const letter = letterState(chapter, now)
  if (letter === 'none' || letter === 'draft') missing.push('letter')
  if (!keepsakesComplete(chapter?.keepsakes)) missing.push('keepsakes')
  return { ready: missing.length === 0, missing }
}

// ---------------------------------------------------------------------------
// Nudges (in-app card and push reminder)
// ---------------------------------------------------------------------------

/**
 * Is the couple's chosen day behind them without a review covering it? Only a
 * gentle orientation — a chapter can always be started earlier or later, and a
 * ritual without a fixed date is never "due".
 */
export function isRitualDue(ritual, chapters = [], now = new Date()) {
  if (!hasAnchor(ritual)) return false
  if (findOpenChapter(chapters)) return false
  const last = previousRitualDate(ritual, now)
  if (!last) return false
  return !chapters.some((c) => {
    const end = toDate(c.periodEnd)
    return end && startOfDay(end) >= last
  })
}

/**
 * What, if anything, "Our Year" wants to tell this person right now. Highest
 * priority first; null when there is nothing to say.
 *
 * 'letterWaiting'    — a sealed letter may be opened
 * 'partnerWaiting'   — your partner handed in their part, yours is missing
 * 'chapterOpen'      — a chapter is in progress
 * 'ritualDue'        — the chosen day has passed without a review
 */
export function ourYearNudge(ritual, chapters = [], uid, now = new Date()) {
  const sorted = sortChapters(chapters)

  const waitingLetter = sorted.find((c) => letterState(c, now) === 'waiting')
  if (waitingLetter) return { kind: 'letterWaiting', chapter: waitingLetter }

  const open = findOpenChapter(sorted)
  if (open) {
    const partnerWaiting = ['reflection', 'quiz'].some(
      (kind) =>
        !isRevealed(open, kind) &&
        !hasSubmitted(open, kind, uid) &&
        (open[kind === 'quiz' ? 'quizSubmittedBy' : 'reflectionSubmittedBy'] ?? []).length > 0,
    )
    return { kind: partnerWaiting ? 'partnerWaiting' : 'chapterOpen', chapter: open }
  }

  if (isRitualDue(ritual, chapters, now)) return { kind: 'ritualDue', chapter: null }
  return null
}

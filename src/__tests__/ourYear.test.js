import { describe, it, expect } from 'vitest'
import {
  anchorDateInYear,
  bothSubmitted,
  canCloseChapter,
  chapterProgress,
  daysUntilRitual,
  defaultQuizQuestions,
  DEFAULT_QUIZ_QUESTION_IDS,
  emptyKeepsakes,
  findOpenChapter,
  formatPeriod,
  isRitualDue,
  keepsakesComplete,
  keepsakesFilledCount,
  letterState,
  newQuestionId,
  nextRitualDate,
  ourYearNudge,
  periodKind,
  previousRitualDate,
  sortChapters,
  suggestChapterPeriod,
  suggestChapterTitle,
  suggestLetterOpenDate,
  toDate,
} from '../utils/ourYear'

const UID_A = 'uid-a'
const UID_B = 'uid-b'

const recurring = { rhythm: 'recurring', anchorMonth: 5, anchorDay: 12 }
const manual = { rhythm: 'manual' }

/** Firestore Timestamp stand-in. */
const ts = (y, m, d) => ({ toDate: () => new Date(y, m - 1, d) })

function chapter(overrides = {}) {
  return {
    id: 'c1',
    participantUids: [UID_A, UID_B],
    status: 'open',
    periodStart: ts(2025, 5, 13),
    periodEnd: ts(2026, 5, 12),
    reflectionSubmittedBy: [],
    quizSubmittedBy: [],
    reflectionsRevealedAt: null,
    quizRevealedAt: null,
    letterStatus: 'none',
    letterOpenAt: null,
    keepsakes: emptyKeepsakes(),
    ...overrides,
  }
}

describe('toDate', () => {
  it('accepts Firestore Timestamps, Dates, strings and epoch millis', () => {
    expect(toDate(ts(2026, 5, 12))).toEqual(new Date(2026, 4, 12))
    expect(toDate(new Date(2026, 4, 12))).toEqual(new Date(2026, 4, 12))
    expect(toDate('2026-05-12T00:00:00.000Z').getUTCFullYear()).toBe(2026)
    expect(toDate(null)).toBeNull()
    expect(toDate('not a date')).toBeNull()
  })
})

describe('anchorDateInYear', () => {
  it('keeps a normal day as-is', () => {
    expect(anchorDateInYear(2026, 5, 12)).toEqual(new Date(2026, 4, 12))
  })

  it('clamps 29 February to 28 February in common years instead of rolling into March', () => {
    expect(anchorDateInYear(2027, 2, 29)).toEqual(new Date(2027, 1, 28))
    expect(anchorDateInYear(2028, 2, 29)).toEqual(new Date(2028, 1, 29))
  })

  it('clamps a 31st in a 30-day month', () => {
    expect(anchorDateInYear(2026, 4, 31)).toEqual(new Date(2026, 3, 30))
  })
})

describe('nextRitualDate / previousRitualDate', () => {
  it('returns this year while the day is still ahead', () => {
    expect(nextRitualDate(recurring, new Date(2026, 2, 1))).toEqual(new Date(2026, 4, 12))
  })

  it('counts today as the next occurrence', () => {
    expect(nextRitualDate(recurring, new Date(2026, 4, 12, 18, 0))).toEqual(new Date(2026, 4, 12))
  })

  it('rolls over the turn of the year once the day has passed', () => {
    expect(nextRitualDate(recurring, new Date(2026, 11, 31))).toEqual(new Date(2027, 4, 12))
    expect(previousRitualDate(recurring, new Date(2026, 0, 2))).toEqual(new Date(2025, 4, 12))
  })

  it('is null without a fixed date', () => {
    expect(nextRitualDate(manual, new Date(2026, 2, 1))).toBeNull()
    expect(previousRitualDate(null, new Date(2026, 2, 1))).toBeNull()
    expect(daysUntilRitual(manual, new Date(2026, 2, 1))).toBeNull()
  })

  it('counts the days until the occasion', () => {
    expect(daysUntilRitual(recurring, new Date(2026, 4, 2))).toBe(10)
  })
})

describe('periodKind', () => {
  it('treats roughly twelve months as a year', () => {
    expect(periodKind(ts(2025, 5, 13), ts(2026, 5, 12))).toBe('year')
  })

  it('treats a shorter or much longer stretch as a free span', () => {
    expect(periodKind(ts(2026, 1, 1), ts(2026, 4, 1))).toBe('span')
    expect(periodKind(ts(2024, 1, 1), ts(2026, 1, 1))).toBe('span')
  })
})

describe('suggestChapterPeriod', () => {
  it('proposes the past year for a first chapter', () => {
    const { start, end } = suggestChapterPeriod(recurring, [], new Date(2026, 7, 1))
    expect(end).toEqual(new Date(2026, 7, 1))
    expect(start).toEqual(new Date(2025, 7, 1))
  })

  it('ends on the upcoming occasion when it is close', () => {
    const { start, end } = suggestChapterPeriod(recurring, [], new Date(2026, 4, 1))
    expect(end).toEqual(new Date(2026, 4, 12))
    expect(start).toEqual(new Date(2025, 4, 12))
  })

  it('picks up the day after the previous chapter ended', () => {
    const previous = chapter({ periodStart: ts(2024, 5, 13), periodEnd: ts(2025, 5, 12) })
    const { start, end } = suggestChapterPeriod(recurring, [previous], new Date(2026, 4, 1))
    expect(start).toEqual(new Date(2025, 4, 13))
    expect(end).toEqual(new Date(2026, 4, 12))
  })

  it('supports a skipped review being caught up later — the span simply grows', () => {
    const previous = chapter({ periodStart: ts(2023, 5, 13), periodEnd: ts(2024, 5, 12) })
    const { start, end } = suggestChapterPeriod(recurring, [previous], new Date(2026, 4, 1))
    expect(start).toEqual(new Date(2024, 4, 13))
    expect(periodKind(start, end)).toBe('span')
  })

  it('never proposes a backwards period when the last chapter already reaches ahead', () => {
    const previous = chapter({ periodEnd: ts(2027, 1, 1) })
    const { start, end } = suggestChapterPeriod(manual, [previous], new Date(2026, 4, 1))
    expect(start.getTime()).toBeLessThan(end.getTime())
  })

  it('works without any fixed date', () => {
    const { start, end } = suggestChapterPeriod(manual, [], new Date(2026, 4, 1))
    expect(end).toEqual(new Date(2026, 4, 1))
    expect(start).toEqual(new Date(2025, 4, 1))
  })
})

describe('suggestChapterTitle', () => {
  it('names a calendar year', () => {
    expect(suggestChapterTitle(ts(2026, 1, 1), ts(2026, 12, 20), 0)).toEqual({
      key: 'chapter.autoTitleYear',
      values: { year: 2026 },
    })
  })

  it('names a year that straddles two calendar years', () => {
    expect(suggestChapterTitle(ts(2025, 5, 13), ts(2026, 5, 12), 2)).toEqual({
      key: 'chapter.autoTitleYearSpan',
      values: { from: 2025, to: 2026 },
    })
  })

  it('falls back to a chapter number for a free span', () => {
    expect(suggestChapterTitle(ts(2026, 1, 1), ts(2026, 4, 1), 4)).toEqual({
      key: 'chapter.autoTitleFallback',
      values: { count: 5 },
    })
  })
})

describe('formatPeriod', () => {
  it('renders both ends', () => {
    expect(formatPeriod(ts(2025, 5, 13), ts(2026, 5, 12), 'de')).toBe('Mai 2025 – Mai 2026')
  })

  it('collapses a single month', () => {
    expect(formatPeriod(ts(2026, 5, 1), ts(2026, 5, 30), 'de')).toBe('Mai 2026')
  })
})

describe('quiz questions', () => {
  it('starts from a neutral default set that assumes no particular way of living', () => {
    const questions = defaultQuizQuestions()
    expect(questions.map((q) => q.id)).toEqual(DEFAULT_QUIZ_QUESTION_IDS)
    expect(questions.map((q) => q.id)).not.toContain('kids')
    questions.forEach((q) => expect(q.presetKey).toBe(q.id))
  })

  it('mints unique ids for questions the couple writes itself', () => {
    expect(newQuestionId()).not.toBe(newQuestionId())
  })
})

describe('letterState', () => {
  const now = new Date(2026, 4, 12)

  it('reports the drafting phases', () => {
    expect(letterState(chapter(), now)).toBe('none')
    expect(letterState(chapter({ letterStatus: 'draft' }), now)).toBe('draft')
  })

  it('stays sealed while the open date is ahead', () => {
    const c = chapter({ letterStatus: 'sealed', letterOpenAt: ts(2027, 5, 12) })
    expect(letterState(c, now)).toBe('sealed')
  })

  it('switches to waiting once the open date has arrived', () => {
    const c = chapter({ letterStatus: 'sealed', letterOpenAt: ts(2026, 4, 12) })
    expect(letterState(c, now)).toBe('waiting')
  })

  it('stays opened afterwards', () => {
    const c = chapter({ letterStatus: 'opened', letterOpenAt: ts(2025, 5, 12) })
    expect(letterState(c, now)).toBe('opened')
  })
})

describe('suggestLetterOpenDate', () => {
  it('proposes the next occasion when it is far enough out', () => {
    expect(suggestLetterOpenDate(recurring, new Date(2026, 0, 10))).toEqual(new Date(2026, 4, 12))
  })

  it('skips a year when the occasion is right around the corner', () => {
    expect(suggestLetterOpenDate(recurring, new Date(2026, 4, 12))).toEqual(new Date(2027, 4, 12))
  })

  it('falls back to one year out without a fixed date', () => {
    expect(suggestLetterOpenDate(manual, new Date(2026, 4, 12))).toEqual(new Date(2027, 4, 12))
  })
})

describe('keepsakes', () => {
  it('counts only genuinely filled slots', () => {
    const k = emptyKeepsakes()
    expect(keepsakesFilledCount(k)).toBe(0)
    k.quote = '   '
    expect(keepsakesFilledCount(k)).toBe(0)
    k.quote = 'Wir machen das schon.'
    k.photoUrl = 'https://example.test/enc'
    k.song.title = 'Ein Lied'
    expect(keepsakesFilledCount(k)).toBe(3)
    expect(keepsakesComplete(k)).toBe(false)
    k.moment = 'Der Abend am Fluss.'
    expect(keepsakesComplete(k)).toBe(true)
  })

  it('needs a song title, not just an artist', () => {
    const k = emptyKeepsakes()
    k.song = { title: '', artist: 'Jemand', link: '' }
    expect(keepsakesFilledCount(k)).toBe(0)
  })
})

describe('chapterProgress', () => {
  it('shows waiting for the partner once you handed in your part', () => {
    const c = chapter({ reflectionSubmittedBy: [UID_A] })
    expect(chapterProgress(c, UID_A).reflection).toBe('waiting')
    expect(chapterProgress(c, UID_B).reflection).toBe('todo')
  })

  it('shows done for both once the answers are revealed', () => {
    const c = chapter({
      reflectionSubmittedBy: [UID_A, UID_B],
      reflectionsRevealedAt: ts(2026, 4, 12),
    })
    expect(chapterProgress(c, UID_A).reflection).toBe('done')
    expect(chapterProgress(c, UID_B).reflection).toBe('done')
  })

  it('treats a sealed letter as done and tracks partial keepsakes', () => {
    const keepsakes = { ...emptyKeepsakes(), quote: 'Na dann.' }
    const c = chapter({ letterStatus: 'sealed', letterOpenAt: ts(2027, 5, 12), keepsakes })
    const progress = chapterProgress(c, UID_A, new Date(2026, 4, 12))
    expect(progress.letter).toBe('done')
    expect(progress.keepsakes).toBe('partial')
  })
})

describe('bothSubmitted', () => {
  it('is true only once every participant handed in', () => {
    expect(bothSubmitted(chapter({ quizSubmittedBy: [UID_A] }), 'quiz')).toBe(false)
    expect(bothSubmitted(chapter({ quizSubmittedBy: [UID_A, UID_B] }), 'quiz')).toBe(true)
  })
})

describe('canCloseChapter', () => {
  const complete = () =>
    chapter({
      reflectionsRevealedAt: ts(2026, 4, 12),
      quizRevealedAt: ts(2026, 4, 12),
      letterStatus: 'sealed',
      letterOpenAt: ts(2027, 5, 12),
      keepsakes: {
        photoUrl: 'https://example.test/enc',
        photoPublicId: 'p',
        song: { title: 'Ein Lied', artist: 'Jemand', link: '' },
        quote: 'Wir machen das schon.',
        moment: 'Der Abend am Fluss.',
      },
    })

  it('is ready when everything is held', () => {
    expect(canCloseChapter(complete(), new Date(2026, 4, 12))).toEqual({ ready: true, missing: [] })
  })

  it('names every missing part', () => {
    const { ready, missing } = canCloseChapter(chapter(), new Date(2026, 4, 12))
    expect(ready).toBe(false)
    expect(missing).toEqual(['reflection', 'quiz', 'letter', 'keepsakes'])
  })

  it('still counts a letter that has already been opened', () => {
    const c = complete()
    c.letterStatus = 'opened'
    expect(canCloseChapter(c, new Date(2026, 4, 12)).ready).toBe(true)
  })
})

describe('isRitualDue', () => {
  it('is due when the chosen day passed without a review covering it', () => {
    const previous = chapter({ status: 'closed', periodEnd: ts(2025, 5, 12) })
    expect(isRitualDue(recurring, [previous], new Date(2026, 5, 1))).toBe(true)
  })

  it('is not due once a chapter reaches past the chosen day', () => {
    const previous = chapter({ status: 'closed', periodEnd: ts(2026, 5, 12) })
    expect(isRitualDue(recurring, [previous], new Date(2026, 5, 1))).toBe(false)
  })

  it('is not due while a chapter is still open', () => {
    expect(isRitualDue(recurring, [chapter({ periodEnd: ts(2025, 5, 12) })], new Date(2026, 5, 1))).toBe(false)
  })

  it('never nags a couple without a fixed date', () => {
    expect(isRitualDue(manual, [], new Date(2026, 5, 1))).toBe(false)
  })
})

describe('sortChapters / findOpenChapter', () => {
  it('sorts newest first and finds the chapter in progress', () => {
    const older = chapter({ id: 'old', status: 'closed', periodStart: ts(2024, 5, 13) })
    const newer = chapter({ id: 'new', periodStart: ts(2025, 5, 13) })
    expect(sortChapters([older, newer]).map((c) => c.id)).toEqual(['new', 'old'])
    expect(findOpenChapter([older, newer]).id).toBe('new')
    expect(findOpenChapter([older])).toBeNull()
  })
})

describe('ourYearNudge', () => {
  const now = new Date(2026, 5, 1)

  it('puts a waiting letter above everything else', () => {
    const waiting = chapter({
      id: 'waiting',
      status: 'closed',
      letterStatus: 'sealed',
      letterOpenAt: ts(2026, 5, 1),
    })
    const open = chapter({ id: 'open', periodStart: ts(2026, 1, 1) })
    const nudge = ourYearNudge(recurring, [waiting, open], UID_A, now)
    expect(nudge.kind).toBe('letterWaiting')
    expect(nudge.chapter.id).toBe('waiting')
  })

  it('tells you when your partner is waiting on your answers', () => {
    const open = chapter({ reflectionSubmittedBy: [UID_B] })
    expect(ourYearNudge(recurring, [open], UID_A, now).kind).toBe('partnerWaiting')
    expect(ourYearNudge(recurring, [open], UID_B, now).kind).toBe('chapterOpen')
  })

  it('points at the chosen day when nothing is in progress', () => {
    const previous = chapter({ status: 'closed', periodEnd: ts(2025, 5, 12) })
    expect(ourYearNudge(recurring, [previous], UID_A, now).kind).toBe('ritualDue')
  })

  it('stays quiet when there is nothing to say', () => {
    const previous = chapter({ status: 'closed', periodEnd: ts(2026, 5, 12) })
    expect(ourYearNudge(recurring, [previous], UID_A, now)).toBeNull()
  })
})

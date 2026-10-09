import { DEMO_CONTENT } from './demoContent'
import { anchorDateInYear, defaultQuizQuestions, emptyKeepsakes } from '../utils/ourYear'

/**
 * The demo family, as the documents Firestore would hold for it.
 *
 * Same shapes as the emulator seed (scripts/seed-emulator.mjs) and as the
 * app's own writes, in plaintext: the family document has no key, which is the
 * app's plaintext mode (see utils/encryption.js), and the pictures are files
 * under public/demo-media/.
 *
 * Dates are counted from the moment the demo starts, so the family never ages:
 * the moments are from this week, "on this day" always has something, the
 * sealed letter opens in a few weeks. What belongs to a season — a summer at
 * the lake, a snow hike — is put in that season of an earlier year instead,
 * where counting back from today would land it anywhere.
 */

export const DEMO_FAMILY_ID = 'demo-family'
export const DEMO_VISITOR_UID = 'demo-visitor'
export const DEMO_PARTNER_UID = 'demo-partner'

const media = (file) => `/demo-media/${file}`

// Which picture goes with which entry of demoContent.js, by position.
const MEMORY_IMAGES = [
  ['lake.webp', 'picnic.webp'],
  ['snow.webp'],
  ['birthday.webp'],
  ['garden.webp'],
  ['kitchen.webp', 'pie.webp'],
  ['pancakes.webp'],
  ['cake.webp'],
  [],
  ['treehouse.webp'],
]
const MOMENT_IMAGES = ['pancakes.webp', 'playground.webp', 'books.webp', 'bike.webp', 'treehouse.webp']
const RECIPE_IMAGES = ['pie.webp', 'kitchen.webp', 'cookies.webp', 'pancakes.webp']

/**
 * @param {{ language?: 'en'|'de', now?: Date }} options
 * @returns {{ documents: Array<[string, object]>, visitor: { uid, name, email } }}
 */
export function buildDemoFamily({ language = 'en', now = new Date() } = {}) {
  const c = DEMO_CONTENT[language] ?? DEMO_CONTENT.en
  const familyId = DEMO_FAMILY_ID
  const visitor = DEMO_VISITOR_UID
  const partner = DEMO_PARTNER_UID
  const participantUids = [visitor, partner]

  const documents = []
  const add = (path, data) => documents.push([path, data])

  // ── Dates ────────────────────────────────────────────────────────────────
  const year = now.getFullYear()
  const today = new Date(year, now.getMonth(), now.getDate())
  // A day of an earlier calendar year, for what belongs to a season.
  const inYear = (yearsBack, month, day, hour = 11) => new Date(year - yearsBack, month - 1, day, hour)
  // Days before today at a given time, never later than now.
  const daysAgo = (days, hour = 10, minute = 0) => {
    const d = new Date(year, now.getMonth(), now.getDate() - days, hour, minute)
    return d > now ? new Date(now.getTime() - 60_000) : d
  }
  const shift = (date, { years = 0, months = 0, days = 0, hour = 12 } = {}) =>
    new Date(date.getFullYear() + years, date.getMonth() + months, date.getDate() + days, hour)
  // Birthdays are stored as the date input writes them: midnight UTC.
  const asBirthdate = (date) => new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))

  // Emma turned eight about five months ago, Leo six about a month ago.
  const emmaBorn = shift(today, { years: -8, months: -5, days: -12, hour: 4 })
  const leoBorn = shift(today, { years: -6, months: -1, days: -3, hour: 9 })

  // ── The family and its two admins ────────────────────────────────────────
  add(`families/${familyId}`, {
    adminUid: visitor,
    adminUids: participantUids,
    familyName: c.family.name,
    familySlug: c.family.slug,
    memoryCardStyle: 'modern',
    createdAt: inYear(3, 1, 6),
  })
  add(`families/${familyId}/admins/${visitor}`, { email: c.visitor.email, addedAt: inYear(3, 1, 6) })
  add(`families/${familyId}/admins/${partner}`, { email: c.partner.email, addedAt: inYear(3, 1, 7) })

  // ── Memories ─────────────────────────────────────────────────────────────
  const memoryDates = [
    inYear(2, 8, 15),
    inYear(2, 12, 3),
    shift(emmaBorn, { years: 6, hour: 15 }),
    inYear(1, 6, 9),
    inYear(1, 11, 28),
    // Exactly two years ago today, for the timeline's "on this day".
    shift(today, { years: -2, hour: 9 }),
    shift(leoBorn, { years: 6, hour: 16 }),
    daysAgo(23, 19, 30),
    daysAgo(9, 17),
  ]
  c.memories.forEach((memory, i) => {
    const images = MEMORY_IMAGES[i].map(media)
    add(`memories/demo-memory-${i + 1}`, {
      ...memory,
      featured: i === 0,
      images,
      imageUrl: images[0] ?? '',
      videos: [],
      voiceMemos: [],
      date: memoryDates[i],
      familyId,
      createdByUid: i % 2 === 0 ? visitor : partner,
      createdAt: memoryDates[i],
    })
  })

  // ── Moments: this week ───────────────────────────────────────────────────
  const momentDates = [daysAgo(0, 8, 10), daysAgo(1, 16, 30), daysAgo(2, 19, 45), daysAgo(4, 17), daysAgo(6, 11)]
  c.moments.forEach((moment, i) => {
    add(`moments/demo-moment-${i + 1}`, {
      ...moment,
      images: [media(MOMENT_IMAGES[i])],
      date: momentDates[i],
      familyId,
      createdByUid: i % 2 === 0 ? visitor : partner,
    })
  })

  // ── Children, with what Emma's birth sky needs ───────────────────────────
  add('children/demo-emma', {
    name: c.kids.emma,
    birthdate: asBirthdate(emmaBorn),
    birthTime: '04:17',
    birthPlace: JSON.stringify(c.birthPlace),
    profilePhoto: media('emma.webp'),
    profilePhotoPublicId: '',
    familyId,
    createdAt: inYear(3, 1, 8),
  })
  add('children/demo-leo', {
    name: c.kids.leo,
    birthdate: asBirthdate(leoBorn),
    profilePhoto: media('leo.webp'),
    profilePhotoPublicId: '',
    familyId,
    createdAt: inYear(3, 1, 9),
  })

  // ── Journal entries and letters ──────────────────────────────────────────
  const journalSlots = [
    { childId: 'demo-emma', date: shift(emmaBorn, { years: 6, months: 4, hour: 8 }), emotion: 'pride', photos: ['school.webp'] },
    { childId: 'demo-emma', date: shift(emmaBorn, { years: 6, months: 9, hour: 19 }), emotion: 'joy', photos: [] },
    { childId: 'demo-emma', date: shift(emmaBorn, { years: 8, hour: 21 }), emotion: 'love', photos: ['birthday.webp'] },
    { childId: 'demo-leo', date: shift(leoBorn, { years: 5, months: 7, hour: 17 }), emotion: 'pride', photos: ['bike.webp'] },
  ]
  c.journals.forEach((entry, i) => {
    const slot = journalSlots[i]
    add(`journals/demo-journal-${i + 1}`, {
      ...entry,
      childId: slot.childId,
      emotion: slot.emotion,
      photos: slot.photos.map(media),
      videos: [],
      voiceMemos: [],
      date: slot.date,
      familyId,
      createdAt: slot.date,
    })
  })

  // ── Recipes: a strudel (or pie) with two generations of forks, and one more
  const recipeSlots = [
    { id: 'demo-recipe-1', year: 1978, parentId: null, rootId: null, createdAt: inYear(3, 2, 1) },
    { id: 'demo-recipe-2', year: 2005, parentId: 'demo-recipe-1', rootId: 'demo-recipe-1', createdAt: inYear(3, 2, 2) },
    { id: 'demo-recipe-3', year: year - 1, parentId: 'demo-recipe-2', rootId: 'demo-recipe-1', createdAt: inYear(1, 3, 15) },
    { id: 'demo-recipe-4', year: 2012, parentId: null, rootId: null, createdAt: inYear(2, 5, 4) },
  ]
  c.recipes.forEach((recipe, i) => {
    const slot = recipeSlots[i]
    const { forkReason, changes, ingredients, ...text } = recipe
    add(`recipes/${slot.id}`, {
      ...text,
      year: slot.year,
      ingredients: ingredients.map((item) => (typeof item === 'string' ? { name: item, status: 'active' } : item)),
      ...(slot.parentId ? { forkReason, changes } : {}),
      parentId: slot.parentId,
      rootId: slot.rootId,
      image: media(RECIPE_IMAGES[i]),
      familyId,
      createdAt: slot.createdAt,
    })
  })

  // ── A scrapbook ──────────────────────────────────────────────────────────
  const photo = (id, file, x, y, width, height, rotation, zIndex, extra = {}) => ({
    id, type: 'photo', url: media(file), isSlot: false, x, y, width, height, rotation, zIndex, ...extra,
  })
  const text = (id, value, x, y, width, height, rotation, zIndex, style) => ({
    id, type: 'text', text: value, x, y, width, height, rotation, zIndex, ...style,
  })
  add('scrapbooks/demo-scrapbook', {
    title: c.scrapbook.title,
    pages: [
      {
        id: 'page-1',
        backgroundColor: '#FDF6EC',
        elements: [
          text('t1', c.scrapbook.headline.replace('{{year}}', year - 2), 40, 40, 720, 110, 0, 1,
            { fontSize: 84, fontWeight: 'bold', fontFamily: 'display', color: '#C25A2E', textAlign: 'center' }),
          photo('p1', 'lake.webp', 60, 180, 300, 340, -6, 2, { polaroid: true }),
          photo('p2', 'picnic.webp', 420, 160, 300, 340, 5, 3, { polaroid: true }),
          photo('p3', 'pancakes.webp', 240, 320, 280, 300, -2, 4, { polaroid: true }),
          text('t2', c.scrapbook.caption, 480, 470, 280, 80, 3, 5,
            { fontSize: 34, fontWeight: 'normal', fontFamily: 'serif', color: '#2D1B0E', textAlign: 'center' }),
        ],
      },
      {
        id: 'page-2',
        backgroundColor: '#F0FFF4',
        elements: [
          photo('p4', 'garden.webp', 40, 40, 720, 400, 0, 1),
          text('t3', c.scrapbook.gardenHeadline, 40, 470, 720, 90, 0, 2,
            { fontSize: 72, fontWeight: 'bold', fontFamily: 'display', color: '#2D1B0E', textAlign: 'center' }),
        ],
      },
    ],
    familyId,
    createdAt: inYear(2, 9, 10),
    updatedAt: inYear(1, 12, 20),
  })

  // ── The Vault: one capsule already open, two sealed for years ────────────
  // The letter sits in blackboxContent, which the demo database — like
  // firestore.rules — hands out only once the capsule's date has come.
  const capsuleSlots = [
    { childId: 'demo-leo', triggerType: 'specificDate', milestone: null, unlockDate: shift(leoBorn, { years: 6, hour: 7 }), createdAt: shift(leoBorn, { years: 2 }), photos: ['cake.webp'] },
    { childId: 'demo-emma', triggerType: 'milestone', milestone: '18thBirthday', unlockDate: shift(emmaBorn, { years: 18, hour: 0 }), createdAt: inYear(3, 4, 22), photos: [] },
    { childId: 'demo-leo', triggerType: 'milestone', milestone: 'wedding', unlockDate: shift(leoBorn, { years: 25, hour: 0 }), createdAt: inYear(2, 9, 10), photos: [] },
  ]
  c.capsules.forEach((capsule, i) => {
    const slot = capsuleSlots[i]
    const id = `demo-capsule-${i + 1}`
    add(`blackbox/${id}`, {
      title: capsule.title,
      childId: slot.childId,
      triggerType: slot.triggerType,
      milestone: slot.milestone,
      unlockDate: slot.unlockDate,
      isSealed: true,
      sealedAt: slot.createdAt,
      familyId,
      createdAt: slot.createdAt,
    })
    add(`blackboxContent/${id}`, {
      message: capsule.message,
      photos: slot.photos.map(media),
      videos: [],
      voiceNote: null,
      familyId,
    })
  })

  // ── Collages and highlight reels ─────────────────────────────────────────
  const collageSlot = (id, file) => ({
    id, url: media(file), thumbUrl: null, imageScale: 1, offsetX: 0, offsetY: 0, flipped: false,
  })
  const collageSlots = [
    { templateId: 'polaroid-pair', aspect: '4:5', files: ['lake.webp', 'picnic.webp'], createdAt: inYear(2, 9, 2) },
    { templateId: 'stacked-trio', aspect: '4:5', files: ['kitchen.webp', 'pie.webp', 'cookies.webp'], createdAt: inYear(1, 11, 30) },
    { templateId: 'mint-four', aspect: '1:1', files: ['birthday.webp', 'garden.webp', 'snow.webp', 'treehouse.webp'], createdAt: daysAgo(5, 20) },
  ]
  c.collages.forEach((title, i) => {
    const slot = collageSlots[i]
    add(`collages/demo-collage-${i + 1}`, {
      title,
      templateId: slot.templateId,
      doc: {
        templateId: slot.templateId,
        aspect: slot.aspect,
        background: null,
        border: { color: '#FFFDF9', width: 0, radius: 0.08, gap: 0 },
        slots: slot.files.map((file, j) => collageSlot('abcd'[j], file)),
      },
      familyId,
      createdAt: slot.createdAt,
      updatedAt: slot.createdAt,
    })
  })

  const reelSlots = [
    { aspect: '9:16', theme: 'warm', files: ['lake.webp', 'picnic.webp', 'garden.webp', 'playground.webp', 'snow.webp'], createdAt: inYear(1, 10, 6) },
    { aspect: '4:5', theme: 'cream', files: ['kitchen.webp', 'pie.webp', 'cookies.webp', 'pancakes.webp'], createdAt: inYear(1, 12, 22) },
    { aspect: '9:16', theme: 'forest', files: ['emma.webp', 'school.webp', 'birthday.webp', 'books.webp'], createdAt: daysAgo(12, 21) },
  ]
  c.highlights.forEach((highlight, i) => {
    const slot = reelSlots[i]
    add(`highlights/demo-reel-${i + 1}`, {
      title: highlight.title,
      doc: {
        aspect: slot.aspect,
        theme: slot.theme,
        transitionMs: 600,
        titleCard: { text: highlight.title, subtitle: highlight.subtitle },
        shots: slot.files.map((file) => ({ url: media(file), thumbUrl: null, memoryId: null, durationMs: 2600 })),
      },
      familyId,
      createdAt: slot.createdAt,
      updatedAt: slot.createdAt,
    })
  })

  // ── Our Year ─────────────────────────────────────────────────────────────
  // The day they met comes round in a few weeks. Behind it: a chapter whose
  // letter has been opened, one whose letter is sealed until that day, and the
  // chapter in progress, where the partner has handed in and the visitor's
  // answers are still missing — so the reveal is theirs to make.
  let anchor = shift(today, { days: 24, hour: 0 })
  if (anchor.getMonth() === 1 && anchor.getDate() === 29) anchor = shift(anchor, { days: 1, hour: 0 })
  const anchorMonth = anchor.getMonth() + 1
  const anchorDay = anchor.getDate()
  const next = anchorDateInYear(anchor.getFullYear(), anchorMonth, anchorDay)
  const occasion = (yearsBack) => anchorDateInYear(next.getFullYear() - yearsBack, anchorMonth, anchorDay)
  const dayAfter = (date) => shift(date, { days: 1, hour: 0 })

  add('ourYearRituals/demo-ritual', {
    familyId,
    participantUids,
    partners: [
      { uid: visitor, name: c.visitor.short },
      { uid: partner, name: c.partner.short },
    ],
    occasionKey: 'firstMet',
    occasionLabel: '',
    rhythm: 'recurring',
    anchorMonth,
    anchorDay,
    createdBy: visitor,
    createdAt: occasion(3),
    updatedAt: occasion(3),
  })

  const chapterTitle = (i) => c.ourYear.chapterTitles[i]
    .replace('{{from}}', occasion(1).getFullYear())
    .replace('{{to}}', next.getFullYear())
  const keepsakes = (i, photo) => ({
    ...emptyKeepsakes(),
    ...c.ourYear.keepsakes[i],
    song: { link: '', ...c.ourYear.keepsakes[i].song },
    photoUrl: photo ? media(photo) : '',
  })
  const closedChapter = (i, start, end, letter, extra) => ({
    familyId,
    ritualId: 'demo-ritual',
    participantUids,
    title: chapterTitle(i),
    titleIsAuto: false,
    periodStart: start,
    periodEnd: end,
    status: 'closed',
    closedAt: end,
    quizQuestions: defaultQuizQuestions(),
    quizReactions: {},
    letterStatus: letter.status,
    letterOpenAt: letter.openAt,
    letterOpenedAt: letter.openedAt,
    createdBy: visitor,
    createdAt: end,
    updatedAt: end,
    ...extra,
  })

  // Two years back: keepsakes and a letter, opened on the next occasion. They
  // skipped the questions that year, which a chapter is free to do.
  add('ourYearChapters/demo-chapter-1', closedChapter(0, dayAfter(occasion(3)), occasion(2),
    { status: 'opened', openAt: occasion(1), openedAt: occasion(1) },
    {
      reflectionSubmittedBy: [],
      quizSubmittedBy: [],
      reflectionsRevealedAt: null,
      quizRevealedAt: null,
      keepsakes: keepsakes(0, 'sunset.webp'),
    }))
  // Last year: everything answered and revealed, the letter sealed until the
  // occasion a few weeks from now.
  add('ourYearChapters/demo-chapter-2', closedChapter(1, dayAfter(occasion(2)), occasion(1),
    { status: 'sealed', openAt: next, openedAt: null },
    {
      reflectionSubmittedBy: participantUids,
      quizSubmittedBy: participantUids,
      reflectionsRevealedAt: occasion(1),
      quizRevealedAt: occasion(1),
      quizReactions: { trip: 'different', phrase: 'same', purchase: 'same', pointlessDebate: 'talk' },
      keepsakes: keepsakes(1, 'walk.webp'),
    }))
  // This year, still open.
  add('ourYearChapters/demo-chapter-3', {
    familyId,
    ritualId: 'demo-ritual',
    participantUids,
    title: chapterTitle(2),
    titleIsAuto: false,
    periodStart: dayAfter(occasion(1)),
    periodEnd: next,
    status: 'open',
    reflectionSubmittedBy: [partner],
    quizSubmittedBy: [partner],
    reflectionsRevealedAt: null,
    quizRevealedAt: null,
    quizQuestions: defaultQuizQuestions(),
    quizReactions: {},
    keepsakes: keepsakes(2, null),
    letterStatus: 'none',
    letterOpenAt: null,
    letterOpenedAt: null,
    closedAt: null,
    createdBy: partner,
    createdAt: daysAgo(14, 20),
    updatedAt: daysAgo(3, 21),
  })

  const entry = (chapterId, kind, author, answers, revealed, submittedAt) => {
    add(`ourYearEntries/${chapterId}_${kind}_${author}`, {
      familyId,
      chapterId,
      participantUids,
      authorUid: author,
      kind,
      answers,
      submitted: true,
      submittedAt,
      revealed,
      createdAt: submittedAt,
      updatedAt: submittedAt,
    })
  }
  const { reflection, quiz } = c.ourYear
  entry('demo-chapter-2', 'reflection', visitor, reflection.visitor, true, occasion(1))
  entry('demo-chapter-2', 'reflection', partner, reflection.partner, true, occasion(1))
  entry('demo-chapter-2', 'quiz', visitor, quiz.visitor, true, occasion(1))
  entry('demo-chapter-2', 'quiz', partner, quiz.partner, true, occasion(1))
  entry('demo-chapter-3', 'reflection', partner, c.ourYear.currentReflection, false, daysAgo(3, 21))
  entry('demo-chapter-3', 'quiz', partner, c.ourYear.currentQuiz, false, daysAgo(3, 21))

  const letter = (chapterId, sections, sealedAt, openAt, openedAt) => {
    add(`ourYearLetters/${chapterId}`, {
      familyId,
      chapterId,
      participantUids,
      sections,
      sealedAt,
      openAt,
      openedAt,
      createdAt: sealedAt,
      updatedAt: openedAt ?? sealedAt,
    })
  }
  letter('demo-chapter-1', c.ourYear.letters[0], occasion(2), occasion(1), occasion(1))
  letter('demo-chapter-2', c.ourYear.letters[1], occasion(1), next, null)

  return {
    documents,
    visitor: { uid: visitor, name: c.visitor.name, email: c.visitor.email },
  }
}

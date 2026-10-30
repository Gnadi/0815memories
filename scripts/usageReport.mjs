/**
 * What the usage log says, per family — the part of scripts/usage-report.mjs
 * that needs no database, so a test can hold it down.
 *
 * Events are `{ familyId, role, name, props, session, createdAt (Date) }`, as
 * src/services/usage.js writes them.
 */

// What a family has to get through, in the order it usually happens. The first
// one missing is where it is stuck.
export const MILESTONES = [
  ['family_created', 'Familie angelegt'],
  ['first_item', 'Erster Inhalt'],
  ['viewer_password_set', 'Zuschauer-Passwort'],
  ['viewer_login', 'Zuschauer angemeldet'],
  ['returned', 'Kam an 2+ Tagen'],
]

// The kind of item each feature page exists to make. A feature that is opened
// many times and never produces one is where people give up.
const FEATURE_MAKES = {
  feed: ['memory', 'moment'],
  journal: ['journal_entry', 'child'],
  vault: ['vault_capsule'],
  recipes: ['recipe'],
  scrapbook: ['scrapbook'],
  collages: ['collage'],
  highlights: ['highlight'],
  our_year: ['our_year_chapter'],
}

const day = (date) => date.toISOString().slice(0, 10)

export function summarizeUsage(events) {
  const families = new Map()

  for (const e of events) {
    let f = families.get(e.familyId)
    if (!f) {
      f = {
        familyId: e.familyId,
        first: e.createdAt,
        last: e.createdAt,
        days: new Set(),
        sessions: new Set(),
        counts: {},
        features: {},
        items: {},
        problems: {},
        at: {},
      }
      families.set(e.familyId, f)
    }
    if (e.createdAt < f.first) f.first = e.createdAt
    if (e.createdAt > f.last) f.last = e.createdAt
    f.counts[e.name] = (f.counts[e.name] ?? 0) + 1
    if (e.name === 'session_started') {
      f.days.add(day(e.createdAt))
      f.sessions.add(e.session)
    }

    const props = e.props ?? {}
    const note = (milestone) => {
      if (!f.at[milestone] || e.createdAt < f.at[milestone]) f.at[milestone] = e.createdAt
    }
    if (e.name === 'family_created') note('family_created')
    if (e.name === 'viewer_password_set') note('viewer_password_set')
    if (e.name === 'viewer_login_succeeded') note('viewer_login')
    if (e.name === 'feature_opened' && props.feature) {
      f.features[props.feature] = (f.features[props.feature] ?? 0) + 1
    }
    if (e.name === 'item_created') {
      f.items[props.kind ?? 'unknown'] = (f.items[props.kind ?? 'unknown'] ?? 0) + 1
      note('first_item')
    }
    if (e.name === 'upload_rejected' || e.name === 'upload_failed' || e.name === 'error_shown') {
      const label = [e.name, props.reason ?? props.area ?? props.kind].filter(Boolean).join(':')
      f.problems[label] = (f.problems[label] ?? 0) + 1
    }
  }

  return [...families.values()]
    .map((f) => {
      if (f.days.size >= 2) f.at.returned = f.last
      const stuckAt = MILESTONES.find(([key]) => !f.at[key])?.[0] ?? null
      const abandoned = Object.entries(FEATURE_MAKES)
        .filter(([feature, kinds]) => f.features[feature] && !kinds.some((k) => f.items[k]))
        .map(([feature]) => feature)
      return { ...f, daysActive: f.days.size, sessionCount: f.sessions.size, stuckAt, abandoned }
    })
    .sort((a, b) => a.first - b.first)
}

const list = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || '—'

/** Plain text, one block per family, for the terminal. */
export function formatReport(summaries, { names = {}, since = null } = {}) {
  if (summaries.length === 0) return 'Keine Ereignisse im Zeitraum.\n'
  const out = []
  if (since) out.push(`Ereignisse seit ${day(since)} · ${summaries.length} Familien\n`)

  // The funnel over all families: how many got how far.
  out.push('Trichter (Familien):')
  for (const [key, label] of MILESTONES) {
    const n = summaries.filter((s) => s.at[key]).length
    out.push(`  ${label.padEnd(24)} ${n}/${summaries.length}`)
  }
  out.push('')

  for (const s of summaries) {
    out.push(`${names[s.familyId] ?? s.familyId} (${s.familyId})`)
    out.push(`  aktiv: ${day(s.first)} bis ${day(s.last)} · ${s.daysActive} Tage · ${s.sessionCount} Besuche`)
    out.push(`  Etappen: ${MILESTONES.map(([key, label]) => `${s.at[key] ? '✓' : '·'} ${label}`).join('  ')}`)
    out.push(`  hängt bei: ${s.stuckAt ? MILESTONES.find(([k]) => k === s.stuckAt)[1] : 'nirgends'}`)
    out.push(`  Bereiche geöffnet: ${list(s.features)}`)
    out.push(`  Inhalte angelegt: ${list(s.items)}`)
    if (s.abandoned.length) out.push(`  geöffnet, nie etwas angelegt: ${s.abandoned.join(', ')}`)
    if (Object.keys(s.problems).length) out.push(`  Probleme: ${list(s.problems)}`)
    out.push('')
  }
  return `${out.join('\n')}\n`
}

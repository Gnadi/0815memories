/**
 * What the usage report makes of the log — scripts/usageReport.mjs.
 */
import { describe, it, expect } from 'vitest'
import { summarizeUsage, formatReport } from '../../scripts/usageReport.mjs'

let n = 0
const at = (isoDay, hour = 10) => new Date(`${isoDay}T${String(hour).padStart(2, '0')}:00:00Z`)
const ev = (familyId, name, when, props = {}, role = 'admin', session = `s${n++}`) =>
  ({ familyId, role, name, props, session, createdAt: when })

describe('summarizeUsage', () => {
  it('finds where a family is stuck: the first step it has not taken', () => {
    const [fam] = summarizeUsage([
      ev('a', 'session_started', at('2026-11-02')),
      ev('a', 'family_created', at('2026-11-02')),
    ])
    expect(fam.stuckAt).toBe('first_item')
  })

  it('reports a family that got through everything as stuck nowhere', () => {
    const [fam] = summarizeUsage([
      ev('a', 'session_started', at('2026-11-02'), {}, 'admin', 's1'),
      ev('a', 'family_created', at('2026-11-02')),
      ev('a', 'item_created', at('2026-11-02'), { kind: 'memory' }),
      ev('a', 'viewer_password_set', at('2026-11-02')),
      ev('a', 'viewer_login_succeeded', at('2026-11-03'), {}, 'viewer'),
      ev('a', 'session_started', at('2026-11-03'), {}, 'admin', 's2'),
    ])
    expect(fam.stuckAt).toBeNull()
    expect(fam.daysActive).toBe(2)
  })

  it('counts returning as being there on two different days, not twice in one', () => {
    const [fam] = summarizeUsage([
      ev('a', 'session_started', at('2026-11-02', 9)),
      ev('a', 'session_started', at('2026-11-02', 18)),
    ])
    expect(fam.at.returned).toBeUndefined()
    expect(fam.sessionCount).toBe(2)
  })

  it('finds a feature that is opened and never produces anything', () => {
    const [fam] = summarizeUsage([
      ev('a', 'feature_opened', at('2026-11-02'), { feature: 'recipes' }),
      ev('a', 'feature_opened', at('2026-11-03'), { feature: 'recipes' }),
      ev('a', 'feature_opened', at('2026-11-03'), { feature: 'journal' }),
      ev('a', 'item_created', at('2026-11-03'), { kind: 'journal_entry' }),
    ])
    expect(fam.features).toEqual({ recipes: 2, journal: 1 })
    expect(fam.abandoned).toEqual(['recipes'])
  })

  it('lists the problems with their reasons', () => {
    const [fam] = summarizeUsage([
      ev('a', 'upload_rejected', at('2026-11-02'), { kind: 'video', reason: 'too_large' }),
      ev('a', 'upload_rejected', at('2026-11-02'), { kind: 'video', reason: 'too_large' }),
      ev('a', 'error_shown', at('2026-11-02'), { area: 'family_key' }),
    ])
    expect(fam.problems).toEqual({ 'upload_rejected:too_large': 2, 'error_shown:family_key': 1 })
  })

  it('keeps families apart', () => {
    const result = summarizeUsage([
      ev('a', 'family_created', at('2026-11-02')),
      ev('b', 'family_created', at('2026-11-01')),
    ])
    expect(result.map((f) => f.familyId)).toEqual(['b', 'a'])
  })
})

describe('formatReport', () => {
  it('says so when there is nothing', () => {
    expect(formatReport([])).toMatch(/Keine Ereignisse/)
  })

  it('names the family, the funnel and the place it is stuck', () => {
    const text = formatReport(
      summarizeUsage([ev('a', 'family_created', at('2026-11-02'))]),
      { names: { a: 'Familie Muster' } },
    )
    expect(text).toContain('Familie Muster (a)')
    expect(text).toContain('Familie angelegt')
    expect(text).toContain('hängt bei: Erster Inhalt')
  })
})

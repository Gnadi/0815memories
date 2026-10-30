/**
 * The shape of a usage event (constants/usageEvents.js), and that the rules
 * accept the same events the code can send.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  USAGE_EVENTS, USAGE_PROP_KEYS, buildUsageEvent, featureForPath,
} from '../constants/usageEvents'

describe('buildUsageEvent', () => {
  it('accepts a known event with short labels', () => {
    expect(buildUsageEvent('item_created', { kind: 'vault_capsule' }))
      .toEqual({ ok: true, value: { name: 'item_created', props: { kind: 'vault_capsule' } } })
  })

  it('accepts an event with no labels, and drops empty ones', () => {
    expect(buildUsageEvent('session_started').value.props).toEqual({})
    expect(buildUsageEvent('upload_failed', { kind: 'image', reason: undefined, area: null }).value.props)
      .toEqual({ kind: 'image' })
  })

  it('keeps a count as text', () => {
    expect(buildUsageEvent('viewer_login_succeeded', { tries: 3 }).value.props).toEqual({ tries: '3' })
  })

  it('refuses an event the app does not know', () => {
    expect(buildUsageEvent('read_secret').ok).toBe(false)
  })

  it('refuses a label that is not a known key', () => {
    expect(buildUsageEvent('item_created', { title: 'abc' }).ok).toBe(false)
  })

  // The guard that keeps content out: a title or a sentence is not a slug.
  it('refuses a label that could be content', () => {
    expect(buildUsageEvent('item_created', { kind: 'Omas Apfelkuchen' }).ok).toBe(false)
    expect(buildUsageEvent('item_created', { kind: 'a'.repeat(41) }).ok).toBe(false)
    expect(buildUsageEvent('error_shown', { area: '/memory/abc?x=1' }).ok).toBe(false)
  })

  it('refuses more labels than the rules allow', () => {
    expect(buildUsageEvent('item_created', { feature: 'a', kind: 'b', reason: 'c', area: 'd' }).ok).toBe(false)
  })
})

describe('featureForPath', () => {
  it.each([
    ['/home', 'feed'],
    ['/memory/abc123', 'feed'],
    ['/recipes/new', 'recipes'],
    ['/recipes/xyz/fork', 'recipes'],
    ['/journal/child1/sky', 'birth_sky'],
    ['/journal/child1/new', 'journal'],
    ['/blackbox/new', 'vault'],
    ['/our-year/setup', 'our_year'],
    ['/settings/login-designer', 'login_designer'],
    ['/settings', 'settings'],
  ])('%s is %s', (path, feature) => {
    expect(featureForPath(path)).toBe(feature)
  })

  it('knows nothing of pages that are not features', () => {
    expect(featureForPath('/')).toBeNull()
    expect(featureForPath('/login')).toBeNull()
    expect(featureForPath('/privacy-policy')).toBeNull()
  })

  it('only ever names a feature that is a valid label', () => {
    for (const path of ['/home', '/best-of/2026-09', '/collage/1', '/highlight/1', '/scrapbook/1']) {
      expect(buildUsageEvent('feature_opened', { feature: featureForPath(path) }).ok).toBe(true)
    }
  })
})

// The rules are the check that counts, and a name present in one list and not
// the other either loses events silently or lets one through unreviewed.
describe('firestore.rules', () => {
  const rules = readFileSync('firestore.rules', 'utf8')
  const shape = rules.slice(rules.indexOf('function usageEventShapeOk'), rules.indexOf('match /usageEvents'))

  // The quoted words of the list that opens at `marker`.
  const listAfter = (marker) => {
    const from = shape.indexOf(marker)
    return [...shape.slice(from, shape.indexOf(']', from)).matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
  }

  it('accepts exactly the event names the code can send', () => {
    expect(listAfter('d.name in [')).toEqual(USAGE_EVENTS)
  })

  it('accepts exactly the label keys the code can send', () => {
    expect(listAfter("d.props.keys().hasOnly([")).toEqual(USAGE_PROP_KEYS)
  })
})

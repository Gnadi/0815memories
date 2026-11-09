// @vitest-environment node
/**
 * When a retried trigger stops — functions/retries.js.
 */
import { describe, it, expect } from 'vitest'
import { givenUp, RETRY_FOR_MS } from '../../functions/retries.js'

const NOW = Date.parse('2026-11-09T12:00:00Z')
const written = (msAgo) => ({ time: new Date(NOW - msAgo).toISOString() })

describe('givenUp', () => {
  it('keeps retrying an event for an hour, and no longer', () => {
    expect(givenUp(written(0), NOW)).toBe(false)
    expect(givenUp(written(RETRY_FOR_MS), NOW)).toBe(false)
    expect(givenUp(written(RETRY_FOR_MS + 1), NOW)).toBe(true)
  })

  it('runs an event whose time it cannot read', () => {
    expect(givenUp({}, NOW)).toBe(false)
    expect(givenUp({ time: 'yesterday' }, NOW)).toBe(false)
    expect(givenUp(undefined, NOW)).toBe(false)
  })
})

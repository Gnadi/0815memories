import { describe, it, expect, beforeEach } from 'vitest'
import { rememberFeedMemory, takeFeedMemory } from '../utils/feedPosition'

describe('feedPosition', () => {
  beforeEach(() => sessionStorage.clear())

  it('hands back the remembered memory once', () => {
    rememberFeedMemory('abc')
    expect(takeFeedMemory()).toBe('abc')
    expect(takeFeedMemory()).toBeNull()
  })

  it('returns null when nothing was remembered', () => {
    expect(takeFeedMemory()).toBeNull()
  })
})

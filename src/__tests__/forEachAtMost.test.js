// @vitest-environment node
/* The scheduled pushes go to families a few at a time (functions/push.js
   forEachAtMost). One after the other they fit about a thousand families into
   the five-minute limit, and one family's error stopped the rest. */
import { describe, it, expect, vi } from 'vitest'
import { forEachAtMost } from '../../functions/push.js'

describe('forEachAtMost', () => {
  it('runs every item, no more than `limit` at once', async () => {
    let open = 0
    let most = 0
    const seen = []
    const result = await forEachAtMost([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      most = Math.max(most, ++open)
      await new Promise((resolve) => setTimeout(resolve, 2))
      seen.push(n)
      open--
    })
    expect(result).toEqual({ done: 7, failed: 0 })
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(most).toBe(3)
  })

  it('carries on past a failing item, and reports it', async () => {
    const onError = vi.fn()
    const done = []
    const result = await forEachAtMost(['a', 'b', 'c'], 2, async (id) => {
      if (id === 'a') throw new Error('FCM down')
      done.push(id)
    }, onError)
    expect(result).toEqual({ done: 2, failed: 1 })
    expect(done.sort()).toEqual(['b', 'c'])
    expect(onError).toHaveBeenCalledWith('a', expect.any(Error))
  })

  it('does nothing for no items', async () => {
    await expect(forEachAtMost([], 5, async () => {})).resolves.toEqual({ done: 0, failed: 0 })
  })
})

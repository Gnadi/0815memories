/* An invite link is an admin credential for the family. In the query it was
   in every request log that keeps full URLs; in the fragment no browser sends
   it anywhere. Links made before keep working. */
import { describe, it, expect } from 'vitest'
import { buildInviteUrl, readInviteToken } from '../utils/inviteToken'

describe('invite links', () => {
  it('carry the token in the fragment, and the family in the query', () => {
    const url = new URL(buildInviteUrl('fam-1', 'tok_en-1'))
    expect(url.pathname).toBe('/invite')
    expect(url.searchParams.get('family')).toBe('fam-1')
    expect(url.searchParams.has('token')).toBe(false)
    expect(url.hash).toBe('#token=tok_en-1')
  })

  it('read back the token they carry', () => {
    const url = new URL(buildInviteUrl('fam-1', 'tok-1'))
    expect(readInviteToken(url.searchParams, url.hash)).toEqual({ token: 'tok-1', fromQuery: false })
  })

  it('still read a link from before, and say where the token was', () => {
    const params = new URLSearchParams('family=fam-1&token=old-tok')
    expect(readInviteToken(params, '')).toEqual({ token: 'old-tok', fromQuery: true })
    expect(readInviteToken(new URLSearchParams('family=fam-1'), '')).toEqual({ token: null, fromQuery: false })
  })
})

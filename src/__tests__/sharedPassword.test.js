// @vitest-environment node
/**
 * What a family's shared password may be — functions/sharedPassword.js.
 *
 * bcrypt reads only the first 72 bytes of a password. A long password changed
 * only past them hashed the same, and the old one kept signing in after the
 * change that was meant to lock it out. So nothing longer may be set; the limit
 * is in UTF-8 bytes, which is what bcrypt counts.
 */
import { describe, it, expect } from 'vitest'
import { MAX_SHARED_PASSWORD_BYTES, sharedPasswordProblem } from '../../functions/sharedPassword.js'

describe('sharedPasswordProblem', () => {
  it('takes a password from 8 characters up to 72 bytes', () => {
    expect(sharedPasswordProblem('correct horse')).toBeNull()
    expect(sharedPasswordProblem('a'.repeat(MAX_SHARED_PASSWORD_BYTES))).toBeNull()
  })

  it('refuses one that is too short', () => {
    expect(sharedPasswordProblem('short')).toBe('too-short')
    expect(sharedPasswordProblem('')).toBe('too-short')
    expect(sharedPasswordProblem(undefined)).toBe('too-short')
  })

  it('refuses one longer than bcrypt reads', () => {
    expect(sharedPasswordProblem('a'.repeat(MAX_SHARED_PASSWORD_BYTES + 1))).toBe('too-long')
  })

  it('counts bytes, not characters', () => {
    // Two bytes each: 36 of them are 72 bytes, 37 are more.
    expect(sharedPasswordProblem('ä'.repeat(36))).toBeNull()
    expect(sharedPasswordProblem('ä'.repeat(37))).toBe('too-long')
    // Four bytes each: 19 emoji are 76 bytes, though only 19 characters.
    expect(sharedPasswordProblem('🌻'.repeat(19))).toBe('too-long')
  })

  it('refuses the change the 72-byte limit made meaningless', () => {
    // The same first 72 bytes, a different end: to bcrypt, the same password.
    const prefix = 'unser-gemeinsames-familienpasswort-'.padEnd(MAX_SHARED_PASSWORD_BYTES, 'x')
    expect(sharedPasswordProblem(`${prefix}-2025`)).toBe('too-long')
    expect(sharedPasswordProblem(`${prefix}-2026`)).toBe('too-long')
  })
})

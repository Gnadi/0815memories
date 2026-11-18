// @vitest-environment node
/* bcrypt reads 72 bytes of a password and ignores the rest. A shared password
   changed only past that point left the old one signing viewers in. */
import { describe, it, expect } from 'vitest'
import { MAX_SHARED_PASSWORD_BYTES as CLIENT, sharedPasswordTooLong } from '../utils/passwordPolicy'
import { MAX_SHARED_PASSWORD_BYTES as SERVER } from '../../functions/viewerLogin.js'

describe('the longest shared password', () => {
  it('is the same in the settings and on the server', () => {
    expect(CLIENT).toBe(SERVER)
  })

  it('counts bytes, as bcrypt does, not characters', () => {
    expect(sharedPasswordTooLong('a'.repeat(72))).toBe(false)
    expect(sharedPasswordTooLong('a'.repeat(73))).toBe(true)
    // 40 characters, 80 bytes.
    expect(sharedPasswordTooLong('ü'.repeat(40))).toBe(true)
  })
})

/* The point of this file is one assertion: what addBox actually hands to
   Firestore. The Black Box shipped with ENCRYPTED_FIELDS = ['content'] while
   CreateBlackBoxPage writes 'message', so encryptFields skipped it and the write
   went out in plaintext — in the app's most sensitive collection, for the life
   of the feature.

   Real crypto here, not a stub: a stub that "encrypts" by prefixing a string
   would have passed against the broken code too. */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { webcrypto } from 'node:crypto'
import { renderHook, act } from '@testing-library/react'

const addDoc = vi.fn(async () => ({ id: 'new' }))
const updateDoc = vi.fn(async () => {})
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ name })),
  doc: vi.fn((_db, name, id) => ({ name, id })),
  query: vi.fn((ref, ...c) => ({ ref, c })),
  orderBy: vi.fn(),
  where: vi.fn(),
  // No listener in these tests: onSnapshot returns its unsubscribe and never fires.
  onSnapshot: vi.fn(() => () => {}),
  addDoc: (...args) => addDoc(...args),
  updateDoc: (...args) => updateDoc(...args),
  deleteDoc: vi.fn(async () => {}),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
}))
vi.mock('../config/firebase', () => ({ db: {} }))
vi.mock('../utils/devLog', () => ({ devWarn: vi.fn(), devError: vi.fn() }))

import { generateEncryptionKey, decryptText } from '../utils/encryption'
import { devWarn } from '../utils/devLog'
import { useBlackBox, isUnlocked } from '../hooks/useBlackBox'

// jsdom has no working crypto.subtle — graft Node's on, as encryption.test.js does.
beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
  }
})

beforeEach(() => {
  vi.clearAllMocks()
})

// The document CreateBlackBoxPage builds, field-for-field.
function capsule() {
  return {
    title: 'For Emma, at 18',
    message: 'By the time you read this…',
    childId: 'kid1',
    triggerType: 'milestone',
    milestone: '18thBirthday',
    unlockDate: 'TS',
    photos: ['https://cdn/a.enc'],
    videos: [],
    voiceNote: null,
  }
}

describe('useBlackBox addBox', () => {
  it('encrypts the capsule\'s words before they reach Firestore', async () => {
    const { key } = await generateEncryptionKey()
    const { result } = renderHook(() => useBlackBox('fam1', key))

    await act(async () => { await result.current.addBox(capsule()) })

    const [, written] = addDoc.mock.calls[0]

    // The assertion that would have failed before this fix.
    expect(written.message).not.toBe('By the time you read this…')
    expect(written.title).not.toBe('For Emma, at 18')
    // And it is genuinely recoverable, not merely mangled.
    expect(await decryptText(key, written.message)).toBe('By the time you read this…')
    expect(await decryptText(key, written.title)).toBe('For Emma, at 18')
  })

  it('leaves the fields that must stay queryable or fetchable alone', async () => {
    const { key } = await generateEncryptionKey()
    const { result } = renderHook(() => useBlackBox('fam1', key))

    await act(async () => { await result.current.addBox(capsule()) })
    const [, written] = addDoc.mock.calls[0]

    // familyId and the trigger drive the rules and the sealed card; the media
    // URLs point at ciphertext already.
    expect(written.familyId).toBe('fam1')
    expect(written.triggerType).toBe('milestone')
    expect(written.milestone).toBe('18thBirthday')
    expect(written.childId).toBe('kid1')
    expect(written.photos).toEqual(['https://cdn/a.enc'])
    expect(written.isSealed).toBe(true)
  })

  it('warns in development when a named field is missing from the document', async () => {
    const { key } = await generateEncryptionKey()
    const { result } = renderHook(() => useBlackBox('fam1', key))

    const { message: _dropped, ...withoutMessage } = capsule()
    await act(async () => { await result.current.addBox(withoutMessage) })

    expect(devWarn).toHaveBeenCalled()
    expect(devWarn.mock.calls[0][0]).toContain('message')
  })

  it('does not warn on a partial update, which legitimately omits fields', async () => {
    const { key } = await generateEncryptionKey()
    const { result } = renderHook(() => useBlackBox('fam1', key))

    await act(async () => { await result.current.updateBox('b1', { unlockDate: 'TS' }) })

    expect(devWarn).not.toHaveBeenCalled()
    expect(updateDoc).toHaveBeenCalled()
  })

  it('still encrypts on update when the words themselves change', async () => {
    const { key } = await generateEncryptionKey()
    const { result } = renderHook(() => useBlackBox('fam1', key))

    await act(async () => { await result.current.updateBox('b1', { message: 'rewritten' }) })

    const [, written] = updateDoc.mock.calls[0]
    expect(written.message).not.toBe('rewritten')
    expect(await decryptText(key, written.message)).toBe('rewritten')
  })
})

describe('isUnlocked', () => {
  const past = { toDate: () => new Date(Date.now() - 1000) }
  const future = { toDate: () => new Date(Date.now() + 60_000) }

  it('opens a capsule whose date has passed', () => {
    expect(isUnlocked({ triggerType: 'specificDate', unlockDate: past })).toBe(true)
  })

  it('keeps a capsule whose date has not', () => {
    expect(isUnlocked({ triggerType: 'specificDate', unlockDate: future })).toBe(false)
  })

  it('keeps a capsule with no date at all', () => {
    expect(isUnlocked({ triggerType: 'specificDate', unlockDate: null })).toBe(false)
  })
})

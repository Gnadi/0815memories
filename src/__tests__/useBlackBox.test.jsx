/* Two things this file is here to hold down.

   One: what addBox hands to Firestore. The Black Box shipped with
   ENCRYPTED_FIELDS = ['content'] while CreateBlackBoxPage writes 'message', so
   encryptFields skipped it and the write went out in plaintext — in the app's
   most sensitive collection, for the life of the feature. Real crypto here, not
   a stub: a stub that "encrypts" by prefixing a string would have passed
   against the broken code too.

   Two: that the letter goes to the sealed document and not the listed one. That
   split is the only reason firestore.rules can withhold it. */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { webcrypto } from 'node:crypto'
import { renderHook, act } from '@testing-library/react'

const batchSet = vi.fn()
const batchCommit = vi.fn(async () => {})
const updateDoc = vi.fn(async () => {})
const deleteDoc = vi.fn(async () => {})
const getDoc = vi.fn()

vi.mock('firebase/firestore', () => ({
  // A collection ref with no id argument stands in for the auto-id ref addBox
  // takes to name both halves of the capsule.
  collection: vi.fn((_db, name) => ({ name })),
  doc: vi.fn((_dbOrRef, name, id) =>
    typeof name === 'string' ? { name, id } : { name: _dbOrRef?.name, id: 'generated' },
  ),
  query: vi.fn((ref, ...c) => ({ ref, c })),
  orderBy: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(() => () => {}),
  getDoc: (...args) => getDoc(...args),
  updateDoc: (...args) => updateDoc(...args),
  deleteDoc: (...args) => deleteDoc(...args),
  writeBatch: vi.fn(() => ({ set: batchSet, commit: batchCommit })),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  Timestamp: { fromDate: (d) => ({ __ts: d.toISOString(), toDate: () => d }) },
}))
vi.mock('../config/firebase', () => ({ db: {} }))
vi.mock('../utils/devLog', () => ({ devWarn: vi.fn(), devError: vi.fn() }))

import { generateEncryptionKey, decryptText } from '../utils/encryption'
import { devWarn } from '../utils/devLog'
import {
  useBlackBox,
  isUnlocked,
  daysUntilUnlock,
  addMonths,
  LEGACY_GRACE_MONTHS,
} from '../hooks/useBlackBox'

// jsdom has no working crypto.subtle — graft Node's on, as encryption.test.js does.
beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  getDoc.mockResolvedValue({ exists: () => false })
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

/** The two batch.set calls addBox makes, by collection. */
function writes() {
  const byCollection = {}
  for (const [ref, data] of batchSet.mock.calls) byCollection[ref.name] = data
  return byCollection
}

describe('useBlackBox addBox', () => {
  it('encrypts the capsule\'s words before they reach Firestore', async () => {
    const { key } = await generateEncryptionKey()
    const { result } = renderHook(() => useBlackBox('fam1', key))

    await act(async () => { await result.current.addBox(capsule()) })
    const { blackbox, blackboxContent } = writes()

    // The assertions that would have failed before the field name was fixed.
    expect(blackboxContent.message).not.toBe('By the time you read this…')
    expect(blackbox.title).not.toBe('For Emma, at 18')
    // And genuinely recoverable, not merely mangled.
    expect(await decryptText(key, blackboxContent.message)).toBe('By the time you read this…')
    expect(await decryptText(key, blackbox.title)).toBe('For Emma, at 18')
  })

  it('puts the letter on the sealed document, not the one the page lists', async () => {
    const { key } = await generateEncryptionKey()
    const { result } = renderHook(() => useBlackBox('fam1', key))

    await act(async () => { await result.current.addBox(capsule()) })
    const { blackbox, blackboxContent } = writes()

    // Nothing readable-before-the-date may remain on the metadata document, or
    // the seal is decorative again.
    expect(blackbox).not.toHaveProperty('message')
    expect(blackbox).not.toHaveProperty('photos')
    expect(blackbox).not.toHaveProperty('videos')
    expect(blackbox).not.toHaveProperty('voiceNote')

    expect(blackboxContent.photos).toEqual(['https://cdn/a.enc'])
    // The content document carries familyId because its own read rule needs it.
    expect(blackboxContent.familyId).toBe('fam1')
  })

  it('commits both halves in one batch', async () => {
    const { key } = await generateEncryptionKey()
    const { result } = renderHook(() => useBlackBox('fam1', key))

    await act(async () => { await result.current.addBox(capsule()) })

    expect(batchSet).toHaveBeenCalledTimes(2)
    expect(batchCommit).toHaveBeenCalledTimes(1)
  })

  it('leaves the fields the rules and the sealed card depend on alone', async () => {
    const { key } = await generateEncryptionKey()
    const { result } = renderHook(() => useBlackBox('fam1', key))

    await act(async () => { await result.current.addBox(capsule()) })
    const { blackbox } = writes()

    expect(blackbox.familyId).toBe('fam1')
    expect(blackbox.triggerType).toBe('milestone')
    expect(blackbox.milestone).toBe('18thBirthday')
    expect(blackbox.childId).toBe('kid1')
    expect(blackbox.unlockDate).toBe('TS')
    expect(blackbox.isSealed).toBe(true)
  })

  it('warns in development when a named field is missing from the document', async () => {
    const { key } = await generateEncryptionKey()
    const { result } = renderHook(() => useBlackBox('fam1', key))

    const { title: _dropped, ...withoutTitle } = capsule()
    await act(async () => { await result.current.addBox(withoutTitle) })

    expect(devWarn).toHaveBeenCalled()
    expect(devWarn.mock.calls[0][0]).toContain('title')
  })

  it('does not warn on a partial update, which legitimately omits fields', async () => {
    const { key } = await generateEncryptionKey()
    const { result } = renderHook(() => useBlackBox('fam1', key))

    await act(async () => { await result.current.updateBox('b1', { unlockDate: 'TS' }) })

    expect(devWarn).not.toHaveBeenCalled()
    expect(updateDoc).toHaveBeenCalled()
  })
})

describe('useBlackBox fetchContent', () => {
  it('decrypts the letter from the content document', async () => {
    const { key } = await generateEncryptionKey()
    const { result } = renderHook(() => useBlackBox('fam1', key))

    const { encryptText } = await import('../utils/encryption')
    const sealed = await encryptText(key, 'Hello Emma')
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ message: sealed, photos: [] }) })

    let content
    await act(async () => { content = await result.current.fetchContent({ id: 'b1' }) })

    expect(content.message).toBe('Hello Emma')
  })

  it('falls back to the inline fields of a capsule that predates the split', async () => {
    const { key } = await generateEncryptionKey()
    const { result } = renderHook(() => useBlackBox('fam1', key))
    getDoc.mockResolvedValue({ exists: () => false })

    let content
    await act(async () => {
      // Already decrypted by the listener, as the real hook would hand it over.
      content = await result.current.fetchContent({
        id: 'old',
        message: 'written before the split',
        photos: ['u1'],
      })
    })

    expect(content.message).toBe('written before the split')
    expect(content.photos).toEqual(['u1'])
  })

  it('returns null when the rules withhold a sealed letter', async () => {
    const { key } = await generateEncryptionKey()
    const { result } = renderHook(() => useBlackBox('fam1', key))
    getDoc.mockRejectedValue(new Error('permission-denied'))

    let content
    await act(async () => { content = await result.current.fetchContent({ id: 'sealed' }) })

    expect(content).toBeNull()
  })
})

describe('useBlackBox checkIn', () => {
  it('pushes the deadline out from the existing date', async () => {
    const { key } = await generateEncryptionKey()
    const { result } = renderHook(() => useBlackBox('fam1', key))

    const future = new Date(Date.now() + 30 * 86_400_000)
    await act(async () => {
      await result.current.checkIn({ id: 'b1', unlockDate: { toDate: () => future } })
    })

    const [, update] = updateDoc.mock.calls[0]
    expect(new Date(update.unlockDate.__ts)).toEqual(addMonths(future, LEGACY_GRACE_MONTHS))
  })

  it('measures from today when the deadline already slipped past', async () => {
    const { key } = await generateEncryptionKey()
    const { result } = renderHook(() => useBlackBox('fam1', key))

    const past = new Date(Date.now() - 10 * 86_400_000)
    await act(async () => {
      await result.current.checkIn({ id: 'b1', unlockDate: { toDate: () => past } })
    })

    // A late check-in must buy a full window, not a moment.
    const [, update] = updateDoc.mock.calls[0]
    expect(new Date(update.unlockDate.__ts).getTime()).toBeGreaterThan(
      addMonths(past, LEGACY_GRACE_MONTHS).getTime(),
    )
  })
})

describe('useBlackBox deleteBox', () => {
  it('removes both halves, content first', async () => {
    const { key } = await generateEncryptionKey()
    const { result } = renderHook(() => useBlackBox('fam1', key))

    await act(async () => { await result.current.deleteBox('b1') })

    expect(deleteDoc.mock.calls.map(([ref]) => ref.name)).toEqual([
      'blackboxContent',
      'blackbox',
    ])
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
    expect(isUnlocked({ unlockDate: null })).toBe(false)
  })

  // The old implementation returned false for legacy unconditionally, so those
  // capsules could never open however long anyone waited.
  it('opens a legacy capsule whose deadline arrived', () => {
    expect(isUnlocked({ triggerType: 'legacy', unlockDate: past })).toBe(true)
  })

  it('keeps a legacy capsule whose deadline has been pushed back', () => {
    expect(isUnlocked({ triggerType: 'legacy', unlockDate: future })).toBe(false)
  })
})

describe('addMonths', () => {
  it('adds whole months', () => {
    expect(addMonths(new Date('2026-01-15T00:00:00Z'), 12).getFullYear()).toBe(2027)
  })

  it('clamps rather than rolling into the next month', () => {
    // 31 January + 1 month is the end of February, not 2 or 3 March.
    const d = addMonths(new Date(2026, 0, 31), 1)
    expect(d.getMonth()).toBe(1)
  })
})

describe('daysUntilUnlock', () => {
  it('counts forward to the date', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const box = { unlockDate: { toDate: () => new Date('2026-01-11T00:00:00Z') } }
    expect(daysUntilUnlock(box, now)).toBe(10)
  })

  it('goes negative once the capsule has opened', () => {
    const now = new Date('2026-01-11T00:00:00Z')
    const box = { unlockDate: { toDate: () => new Date('2026-01-01T00:00:00Z') } }
    expect(daysUntilUnlock(box, now)).toBe(-10)
  })

  it('has no answer without a date', () => {
    expect(daysUntilUnlock({ unlockDate: null })).toBeNull()
  })
})

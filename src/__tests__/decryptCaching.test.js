import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  encryptText,
  decryptText,
  decryptFields,
  generateEncryptionKey,
  clearDecryptedTextCache,
  DECRYPT_FAILED,
} from '../utils/encryption'

let key

beforeEach(async () => {
  clearDecryptedTextCache()
  if (!key) ({ key } = await generateEncryptionKey())
})

afterEach(() => {
  clearDecryptedTextCache()
  vi.restoreAllMocks()
})

describe('decryptText caching', () => {
  it('returns the same plaintext from the cache as from a real decrypt', async () => {
    const ciphertext = await encryptText(key, 'Sommer am See')

    const first = await decryptText(key, ciphertext)
    const second = await decryptText(key, ciphertext)

    expect(first).toBe('Sommer am See')
    expect(second).toBe(first)
  })

  it('only runs the crypto once per ciphertext', async () => {
    const ciphertext = await encryptText(key, 'Sommer am See')
    await decryptText(key, ciphertext)

    // Firestore re-emits constantly; a repeat must not touch the crypto engine.
    const spy = vi.spyOn(crypto.subtle, 'decrypt')
    expect(await decryptText(key, ciphertext)).toBe('Sommer am See')
    expect(spy).not.toHaveBeenCalled()
  })

  it('does not remember a value that failed to decrypt', async () => {
    const damaged = 'not a ciphertext'
    await expect(decryptText(key, damaged)).rejects.toMatchObject({ code: DECRYPT_FAILED })

    // A failure is reported every time, never turned into text by the cache.
    const spy = vi.spyOn(crypto.subtle, 'decrypt')
    await expect(decryptText(key, damaged)).rejects.toMatchObject({ code: DECRYPT_FAILED })
    expect(spy).toHaveBeenCalled()
  })

  it('keeps one memo per key, so another key does not read from it', async () => {
    const ciphertext = await encryptText(key, 'Sommer am See')
    expect(await decryptText(key, ciphertext)).toBe('Sommer am See')

    const { key: otherKey } = await generateEncryptionKey()
    await expect(decryptText(otherKey, ciphertext)).rejects.toMatchObject({ code: DECRYPT_FAILED })
  })

  it('clearing the cache makes the next call decrypt again', async () => {
    const ciphertext = await encryptText(key, 'Sommer am See')
    await decryptText(key, ciphertext)
    clearDecryptedTextCache()

    const spy = vi.spyOn(crypto.subtle, 'decrypt')
    expect(await decryptText(key, ciphertext)).toBe('Sommer am See')
    expect(spy).toHaveBeenCalled()
  })

  it('keeps distinct ciphertexts apart', async () => {
    const a = await encryptText(key, 'first')
    const b = await encryptText(key, 'second')

    expect(await decryptText(key, a)).toBe('first')
    expect(await decryptText(key, b)).toBe('second')
    expect(await decryptText(key, a)).toBe('first')
  })
})

describe('decryptFields', () => {
  it('decrypts every listed field and leaves the rest alone', async () => {
    const doc = {
      id: 'm1',
      title: await encryptText(key, 'Title'),
      content: await encryptText(key, 'Content'),
      images: ['a.enc'],
      featured: true,
    }

    const result = await decryptFields(key, doc, ['title', 'content', 'quote'])

    expect(result.title).toBe('Title')
    expect(result.content).toBe('Content')
    expect(result.images).toEqual(['a.enc'])
    expect(result.featured).toBe(true)
    expect(result.quote).toBeUndefined()
    // Never mutates the snapshot object it was handed.
    expect(doc.title).not.toBe('Title')
  })

  it('returns the object untouched without a key', async () => {
    const doc = { title: 'still encrypted' }
    expect(await decryptFields(null, doc, ['title'])).toBe(doc)
  })
})

import { describe, it, expect, beforeAll } from 'vitest'
import { webcrypto } from 'node:crypto'
import {
  generateEncryptionKey,
  importEncryptionKey,
  encryptText,
  decryptText,
  encryptFields,
  decryptFields,
  encryptJSON,
  decryptJSON,
  encryptBlob,
  decryptBlob,
} from '../utils/encryption'

// jsdom doesn't provide a functional crypto.subtle — graft Node's webcrypto on
// the existing `crypto` object so the module under test (which calls
// `crypto.subtle.*` / `crypto.getRandomValues`) works unchanged.
beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
  }
})

describe('encryption helpers', () => {
  it('round-trips plaintext through encryptText/decryptText', async () => {
    const { key } = await generateEncryptionKey()
    const ciphertext = await encryptText(key, 'hello world')
    expect(ciphertext).not.toBe('hello world')
    expect(typeof ciphertext).toBe('string')
    const decrypted = await decryptText(key, ciphertext)
    expect(decrypted).toBe('hello world')
  })

  it('handles empty strings and nullish values without throwing', async () => {
    const { key } = await generateEncryptionKey()
    // Empty strings are valid plaintext — they get encrypted and must round-trip.
    const encryptedEmpty = await encryptText(key, '')
    expect(typeof encryptedEmpty).toBe('string')
    expect(await decryptText(key, encryptedEmpty)).toBe('')
    // Nullish values pass through untouched.
    expect(await encryptText(key, null)).toBe(null)
    expect(await encryptText(key, undefined)).toBe(undefined)
    expect(await decryptText(key, null)).toBe(null)
    expect(await decryptText(key, undefined)).toBe(undefined)
  })

  it('returns ciphertext unchanged when decryption fails (legacy plaintext)', async () => {
    const { key } = await generateEncryptionKey()
    const decrypted = await decryptText(key, 'not-base64-ciphertext')
    expect(decrypted).toBe('not-base64-ciphertext')
  })

  it('produces different ciphertexts for the same plaintext (random IV)', async () => {
    const { key } = await generateEncryptionKey()
    const a = await encryptText(key, 'same input')
    const b = await encryptText(key, 'same input')
    expect(a).not.toBe(b)
  })

  it('exports + re-imports a JWK and decrypts with the imported key', async () => {
    const { key, jwk } = await generateEncryptionKey()
    const ciphertext = await encryptText(key, 'secret')
    const reimported = await importEncryptionKey(jwk)
    expect(await decryptText(reimported, ciphertext)).toBe('secret')
  })

  it('encryptFields/decryptFields round-trip only the named string fields', async () => {
    const { key } = await generateEncryptionKey()
    const obj = { title: 'Trip', location: 'Paris', year: 2024, tags: null }
    const encrypted = await encryptFields(key, obj, ['title', 'location', 'missing', 'year'])
    // Numbers and nulls untouched
    expect(encrypted.year).toBe(2024)
    expect(encrypted.tags).toBe(null)
    expect(encrypted.title).not.toBe('Trip')
    expect(encrypted.location).not.toBe('Paris')

    const decrypted = await decryptFields(key, encrypted, ['title', 'location'])
    expect(decrypted.title).toBe('Trip')
    expect(decrypted.location).toBe('Paris')
  })

  it('returns the object unchanged when key is null', async () => {
    const obj = { title: 'plain' }
    expect(await encryptFields(null, obj, ['title'])).toBe(obj)
    expect(await decryptFields(null, obj, ['title'])).toBe(obj)
  })

  it('round-trips JSON payloads', async () => {
    const { key } = await generateEncryptionKey()
    const payload = { ingredients: ['salt', 'pepper'], steps: 3 }
    const encrypted = await encryptJSON(key, payload)
    expect(typeof encrypted).toBe('string')
    const decrypted = await decryptJSON(key, encrypted)
    expect(decrypted).toEqual(payload)
  })

  it('round-trips a Blob via encryptBlob/decryptBlob', async () => {
    const { key } = await generateEncryptionKey()
    const source = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'application/octet-stream' })
    const encrypted = await encryptBlob(key, source)
    const decryptedBlob = await decryptBlob(key, encrypted, 'application/octet-stream')
    const bytes = new Uint8Array(await decryptedBlob.arrayBuffer())
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4, 5])
  })
})

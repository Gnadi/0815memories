/**
 * The rich description is the first memory field that is not natively a string.
 *
 * encryptFields() skips non-strings silently, and memory documents are
 * world-readable (`allow read: if true`), so a document object reaching
 * Firestore unencrypted would leak the whole story without anything appearing
 * broken. These tests pin the contract that keeps that from happening:
 * `contentRich` is a string on the way out, and only the single-document read
 * path turns it back into a document.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { generateEncryptionKey } from '../utils/encryption'
import {
  MEMORY_TEXT_FIELDS,
  MEMORY_WRITE_FIELDS,
  encryptMemoryData,
  decryptMemoryDoc,
} from '../hooks/useMemories'

const DOC = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Der Sommer bei Oma' }] },
    { type: 'encryptedImage', attrs: { src: 'https://cloudinary/x', caption: 'Am See' } },
  ],
}

let key

beforeAll(async () => {
  ;({ key } = await generateEncryptionKey())
})

const memory = (overrides = {}) => ({
  title: 'Sommer',
  content: 'Der Sommer bei Oma\n\nAm See',
  contentRich: JSON.stringify(DOC),
  ...overrides,
})

describe('MEMORY_WRITE_FIELDS', () => {
  it('carries contentRich so it rides the ordinary encryptFields path', () => {
    expect(MEMORY_WRITE_FIELDS).toContain('contentRich')
    expect(MEMORY_TEXT_FIELDS).not.toContain('contentRich')
  })
})

describe('encryptMemoryData', () => {
  it('writes contentRich as ciphertext, never as a readable object', async () => {
    const out = await encryptMemoryData(key, memory())
    expect(typeof out.contentRich).toBe('string')
    expect(out.contentRich).not.toContain('Oma')
    // base64 output — a plaintext document would start with '{', which is what
    // firestore.rules rejects.
    expect(out.contentRich.startsWith('{')).toBe(false)
  })

  it('throws rather than silently writing a plaintext document object', async () => {
    await expect(encryptMemoryData(key, memory({ contentRich: DOC }))).rejects.toThrow(
      /must be a JSON string/
    )
  })

  it('still refuses an object when there is no key', async () => {
    await expect(encryptMemoryData(null, memory({ contentRich: DOC }))).rejects.toThrow()
  })

  it('leaves a memory without contentRich alone', async () => {
    const out = await encryptMemoryData(key, { title: 'Nur Text', content: 'Hallo' })
    expect(out.contentRich).toBeUndefined()
    expect(typeof out.title).toBe('string')
    expect(out.title).not.toBe('Nur Text')
  })
})

describe('decryptMemoryDoc', () => {
  it('round-trips the document back to a parsed object', async () => {
    const encrypted = await encryptMemoryData(key, memory())
    const decrypted = await decryptMemoryDoc(key, encrypted)
    expect(decrypted.contentRich).toEqual(DOC)
    expect(decrypted.content).toBe('Der Sommer bei Oma\n\nAm See')
  })

  it('is idempotent, because the edit modal re-decrypts defensively', async () => {
    const encrypted = await encryptMemoryData(key, memory())
    const once = await decryptMemoryDoc(key, encrypted)
    const twice = await decryptMemoryDoc(key, once)
    expect(twice.contentRich).toEqual(DOC)
    expect(twice.title).toBe('Sommer')
  })

  it('leaves a legacy memory with no contentRich untouched', async () => {
    const encrypted = await encryptMemoryData(key, { title: 'Alt', content: 'Nur Text' })
    const decrypted = await decryptMemoryDoc(key, encrypted)
    expect(decrypted.contentRich).toBeUndefined()
    expect(decrypted.content).toBe('Nur Text')
  })
})

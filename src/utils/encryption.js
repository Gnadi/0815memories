/**
 * AES-256-GCM encryption utilities using the Web Crypto API.
 * Each ciphertext is prefixed with a random 12-byte IV.
 */

import { devWarn } from './devLog'

const ALGO = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH = 12 // bytes

// ── Key management ──────────────────────────────────────────────────

export async function generateEncryptionKey() {
  const key = await crypto.subtle.generateKey(
    { name: ALGO, length: KEY_LENGTH },
    true, // extractable
    ['encrypt', 'decrypt']
  )
  const jwk = await crypto.subtle.exportKey('jwk', key)
  return { key, jwk }
}

export async function importEncryptionKey(jwk) {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: ALGO, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

// ── Low-level encrypt / decrypt ─────────────────────────────────────

async function encryptBuffer(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGO, iv },
    key,
    data
  )
  // Prepend IV to ciphertext
  const result = new Uint8Array(IV_LENGTH + ciphertext.byteLength)
  result.set(iv)
  result.set(new Uint8Array(ciphertext), IV_LENGTH)
  return result.buffer
}

async function decryptBuffer(key, data) {
  const bytes = new Uint8Array(data)
  // subarray, not slice: both are views onto the same bytes, whereas slice()
  // would copy the entire payload — several megabytes for a photo.
  const iv = bytes.subarray(0, IV_LENGTH)
  const ciphertext = bytes.subarray(IV_LENGTH)
  return crypto.subtle.decrypt({ name: ALGO, iv }, key, ciphertext)
}

// ── Text encrypt / decrypt ──────────────────────────────────────────

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export async function encryptText(key, plaintext) {
  if (!plaintext && plaintext !== '') return plaintext
  const encoded = encoder.encode(plaintext)
  const encrypted = await encryptBuffer(key, encoded)
  return arrayBufferToBase64(encrypted)
}

// Memo of ciphertext -> plaintext.
//
// Firestore re-emits a snapshot on every metadata change and on every write to
// the collection, and each emit used to re-run the full decrypt for every field
// of every document — 300 AES operations for the home feed alone. Moving
// between routes paid it again, because each route sets up its own listener.
//
// It also covers the most wasteful case: for data written before encryption
// existed, every decrypt throws a DOMException that is caught and discarded —
// per field, per document, per emit. That outcome is cached too.
//
// Ciphertexts are unique (random IV per encryption), so the ciphertext alone is
// a safe key. Cleared on logout together with the decrypted media cache.
const textCache = new Map()
const MAX_TEXT_CACHE_ENTRIES = 5000

export function clearDecryptedTextCache() {
  textCache.clear()
}

export async function decryptText(key, ciphertext) {
  if (!ciphertext) return ciphertext

  const cached = textCache.get(ciphertext)
  if (cached !== undefined) return cached

  let plaintext
  try {
    const buffer = base64ToArrayBuffer(ciphertext)
    const decrypted = await decryptBuffer(key, buffer)
    plaintext = decoder.decode(decrypted)
  } catch {
    // Return as-is if decryption fails (e.g. plaintext data from before encryption)
    plaintext = ciphertext
  }

  if (textCache.size >= MAX_TEXT_CACHE_ENTRIES) {
    // Map preserves insertion order, so this drops the oldest entry.
    textCache.delete(textCache.keys().next().value)
  }
  textCache.set(ciphertext, plaintext)
  return plaintext
}

// ── Blob encrypt / decrypt ──────────────────────────────────────────

export async function encryptBlob(key, blob) {
  const arrayBuffer = await blob.arrayBuffer()
  return encryptBuffer(key, arrayBuffer)
}

export async function decryptBlob(key, encryptedArrayBuffer, mimeType = 'application/octet-stream') {
  const decrypted = await decryptBuffer(key, encryptedArrayBuffer)
  return new Blob([decrypted], { type: mimeType })
}

// ── Field-level helpers ─────────────────────────────────────────────

/**
 * Encrypt the named string fields of an object, in place on a shallow copy.
 *
 * A field that is absent is skipped in silence, which is what a partial update
 * needs — `updateBox(id, { unlockDate })` must not be forced to carry every
 * encrypted field. But that same silence let the Black Box ship plaintext for
 * the life of the feature: the field list said 'content' while the create page
 * wrote 'message', and nothing anywhere said so.
 *
 * So create paths, which do know the full shape of the document, can opt into
 * `warnMissing` and hear about it in development. Keep it off for updates.
 */
export async function encryptFields(key, obj, fields, { warnMissing = false } = {}) {
  if (!key) return obj
  const result = { ...obj }
  for (const field of fields) {
    if (result[field] != null && typeof result[field] === 'string') {
      result[field] = await encryptText(key, result[field])
    } else if (warnMissing && result[field] == null) {
      devWarn(
        `encryptFields: "${field}" is absent, so it will be stored unencrypted. ` +
          'Either the field list or the document shape is wrong.',
      )
    }
  }
  return result
}

export async function decryptFields(key, obj, fields) {
  if (!key) return obj
  const result = { ...obj }
  // In parallel: the fields are independent, and awaiting them one after the
  // other made a six-field document six serial round trips through the crypto
  // engine.
  await Promise.all(
    fields.map(async (field) => {
      if (result[field] != null && typeof result[field] === 'string') {
        result[field] = await decryptText(key, result[field])
      }
    })
  )
  return result
}

/**
 * Encrypt a JSON-serializable value as a single encrypted string.
 * Used for complex fields like ingredients arrays or scrapbook elements.
 */
export async function encryptJSON(key, value) {
  if (!key || value == null) return value
  return encryptText(key, JSON.stringify(value))
}

export async function decryptJSON(key, ciphertext) {
  if (!key || ciphertext == null) return ciphertext
  try {
    const json = await decryptText(key, ciphertext)
    return JSON.parse(json)
  } catch {
    // If it's not encrypted JSON, return as-is
    return ciphertext
  }
}

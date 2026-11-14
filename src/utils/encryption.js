/**
 * AES-256-GCM encryption utilities using the Web Crypto API.
 * Each ciphertext is prefixed with a random 12-byte IV.
 */

import { devError, devWarn } from './devLog'
import { isDemoMode } from '../demo/demoMode'
import { reportUnreadable, resetUnreadable } from './unreadableContent'

const ALGO = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH = 12 // bytes

// The `code` of the error thrown below, so it can be told from a failed encryption.
export const MISSING_KEY = 'encryption/missing-key'

function missingKeyError() {
  const err = new Error('The family key is not loaded, so nothing can be encrypted')
  err.code = MISSING_KEY
  return err
}

// Whether to write a value as it is. Only the demo family has no key: its
// content is made up and never leaves the tab (demo/demoMode.js). Every other
// family has had one since signup, so a missing key is one that did not load,
// and going on would store family content in plaintext. That used to be what
// happened, silently; now it throws.
function writesWithoutKey(key) {
  if (key) return false
  if (isDemoMode()) return true
  throw missingKeyError()
}

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
  if (writesWithoutKey(key)) return plaintext
  const encoded = encoder.encode(plaintext)
  const encrypted = await encryptBuffer(key, encoded)
  return arrayBufferToBase64(encrypted)
}

// The `code` of the error decryptText throws. Every stored value is ciphertext
// (Kaydo opens no family from before encryption), so a value that does not
// decrypt is a wrong key or damaged data, never a value to show as it is. It
// used to be shown as it was: the fallback for pre-encryption data turned a
// wrong key into a screen of base64, and nothing anywhere said so.
export const DECRYPT_FAILED = 'encryption/decrypt-failed'

function decryptFailedError(cause) {
  const err = new Error('A stored value could not be decrypted with the family key')
  err.code = DECRYPT_FAILED
  err.cause = cause
  return err
}

export function isDecryptError(err) {
  return err?.code === DECRYPT_FAILED
}

// Memo of ciphertext -> plaintext, one per key.
//
// Firestore re-emits a snapshot on every metadata change and on every write to
// the collection, and each emit used to re-run the full decrypt for every field
// of every document — 300 AES operations for the home feed alone. Moving
// between routes paid it again, because each route sets up its own listener.
//
// Per key, because a ciphertext is only ever the plaintext under the key that
// made it, and a session can move to another family. Failures are not kept: a
// value that did not decrypt is reported each time, not remembered as text.
// Ciphertexts are unique (random IV per encryption), so within one key the
// ciphertext alone is a safe memo key. Cleared on logout and family switch,
// together with the decrypted media cache.
let textCaches = new WeakMap()
const MAX_TEXT_CACHE_ENTRIES = 5000

export function clearDecryptedTextCache() {
  textCaches = new WeakMap()
  resetUnreadable()
}

function textCacheFor(key) {
  let cache = textCaches.get(key)
  if (!cache) {
    cache = new Map()
    textCaches.set(key, cache)
  }
  return cache
}

/**
 * Decrypt one stored string. Throws a DECRYPT_FAILED error when it does not
 * decrypt — read through decryptFields or decryptJSONFields, which turn that
 * into an unreadable field instead of a failed document.
 */
export async function decryptText(key, ciphertext) {
  if (!ciphertext) return ciphertext
  if (!key) throw missingKeyError()

  const cache = textCacheFor(key)
  const cached = cache.get(ciphertext)
  if (cached !== undefined) return cached

  let plaintext
  try {
    const buffer = base64ToArrayBuffer(ciphertext)
    const decrypted = await decryptBuffer(key, buffer)
    plaintext = decoder.decode(decrypted)
  } catch (err) {
    throw decryptFailedError(err)
  }

  if (cache.size >= MAX_TEXT_CACHE_ENTRIES) {
    // Map preserves insertion order, so this drops the oldest entry.
    cache.delete(cache.keys().next().value)
  }
  cache.set(ciphertext, plaintext)
  return plaintext
}

// ── Blob encrypt / decrypt ──────────────────────────────────────────

export async function encryptBlob(key, blob) {
  // No demo case: the demo keeps its uploads in the tab and never gets here
  // (utils/encryptedUpload.js).
  if (!key) throw missingKeyError()
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
  if (writesWithoutKey(key)) return obj
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

/**
 * Decrypt an array of independently-encrypted strings, in parallel.
 *
 * For companion arrays like `thumbsTiny`, where each entry is its own ciphertext
 * rather than one encrypted blob. Non-strings and empty slots pass through, so a
 * partially-filled positional array keeps its shape, and an entry that does not
 * decrypt becomes an empty slot: these are blur-up previews, and the photo
 * behind each one loads without it. Returns the input unchanged without a key.
 */
export async function decryptStringArray(key, values) {
  if (!key || !Array.isArray(values)) return values
  let failed = 0
  const result = await Promise.all(
    values.map(async (value) => {
      if (typeof value !== 'string' || value === '') return value
      try {
        return await decryptText(key, value)
      } catch (err) {
        if (!isDecryptError(err)) throw err
        failed++
        return null
      }
    }),
  )
  if (failed > 0) devError(`decryptStringArray: ${failed} of ${values.length} entries did not decrypt`)
  return result
}

// Decrypt the named string fields of `obj` with `decode`, in parallel: the
// fields are independent, and awaiting them one after the other made a
// six-field document six serial round trips through the crypto engine.
//
// A field that does not decrypt becomes null and is listed in
// `unreadableFields`, so the document still shows and says what it is missing.
// Throwing instead would fail the whole snapshot in subscribeDecrypted and
// empty a list over one damaged field.
async function decodeFields(key, obj, fields, decode) {
  if (!key) return obj
  const result = { ...obj }
  const unreadable = []
  const ciphertexts = []
  await Promise.all(
    fields.map(async (field) => {
      if (typeof result[field] !== 'string') return
      const stored = result[field]
      try {
        result[field] = await decode(key, stored)
      } catch (err) {
        if (!isDecryptError(err)) throw err
        result[field] = null
        unreadable.push(field)
        ciphertexts.push(stored)
      }
    }),
  )
  if (unreadable.length > 0) {
    // Field names only: the values are family content.
    devError(`Could not decrypt ${unreadable.join(', ')} of a document`)
    reportUnreadable(ciphertexts)
    result.unreadableFields = [...new Set([...(result.unreadableFields ?? []), ...unreadable])]
  }
  return result
}

/** Decrypt the named string fields of an object; see decodeFields. */
export async function decryptFields(key, obj, fields) {
  return decodeFields(key, obj, fields, decryptText)
}

/** Decrypt and parse the named encryptJSON fields of an object; see decodeFields. */
export async function decryptJSONFields(key, obj, fields) {
  return decodeFields(key, obj, fields, decryptJSON)
}

/** Whether decryptFields or decryptJSONFields had to give up on a field of this document. */
export function hasUnreadableFields(obj, fields = null) {
  const unreadable = obj?.unreadableFields
  if (!Array.isArray(unreadable) || unreadable.length === 0) return false
  return fields == null || fields.some((field) => unreadable.includes(field))
}

/**
 * Encrypt a JSON-serializable value as a single encrypted string.
 * Used for complex fields like ingredients arrays or scrapbook elements.
 */
export async function encryptJSON(key, value) {
  if (value == null || writesWithoutKey(key)) return value
  return encryptText(key, JSON.stringify(value))
}

/**
 * Decrypt and parse an encryptJSON value. Throws DECRYPT_FAILED when it does
 * not decrypt, or decrypts to something that is not JSON — encryptJSON never
 * writes that, so it is damage too.
 */
export async function decryptJSON(key, ciphertext) {
  if (!key || ciphertext == null) return ciphertext
  const json = await decryptText(key, ciphertext)
  try {
    return JSON.parse(json)
  } catch (err) {
    throw decryptFailedError(err)
  }
}

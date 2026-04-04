/**
 * AES-256-GCM encryption utilities using the Web Crypto API.
 * Each ciphertext is prefixed with a random 12-byte IV.
 */

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
  const iv = bytes.slice(0, IV_LENGTH)
  const ciphertext = bytes.slice(IV_LENGTH)
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

export async function decryptText(key, ciphertext) {
  if (!ciphertext) return ciphertext
  try {
    const buffer = base64ToArrayBuffer(ciphertext)
    const decrypted = await decryptBuffer(key, buffer)
    return decoder.decode(decrypted)
  } catch {
    // Return as-is if decryption fails (e.g. plaintext data from before encryption)
    return ciphertext
  }
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

export async function encryptFields(key, obj, fields) {
  if (!key) return obj
  const result = { ...obj }
  for (const field of fields) {
    if (result[field] != null && typeof result[field] === 'string') {
      result[field] = await encryptText(key, result[field])
    }
  }
  return result
}

export async function decryptFields(key, obj, fields) {
  if (!key) return obj
  const result = { ...obj }
  for (const field of fields) {
    if (result[field] != null && typeof result[field] === 'string') {
      result[field] = await decryptText(key, result[field])
    }
  }
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

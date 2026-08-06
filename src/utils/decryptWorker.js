/**
 * Off-thread AES-256-GCM decryption for media blobs.
 *
 * Same wire format as utils/encryption.js: a 12-byte random IV followed by the
 * ciphertext. This file must stay in lockstep with `decryptBuffer` there.
 *
 * The CryptoKey arrives by structured clone (which works even though the key is
 * imported as non-extractable) and is kept for the life of the worker, so each
 * job carries only bytes.
 */

const IV_LENGTH = 12

let key = null

self.onmessage = async (event) => {
  const { type, id, buffer, key: incomingKey } = event.data

  if (type === 'key') {
    key = incomingKey
    return
  }

  try {
    if (!key) throw new Error('Worker has no key')
    const bytes = new Uint8Array(buffer)
    // subarray, not slice: a view costs nothing, a copy costs the whole file.
    const iv = bytes.subarray(0, IV_LENGTH)
    const ciphertext = bytes.subarray(IV_LENGTH)
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    self.postMessage({ id, plaintext }, [plaintext])
  } catch (err) {
    self.postMessage({ id, error: err?.message || 'Decryption failed' })
  }
}

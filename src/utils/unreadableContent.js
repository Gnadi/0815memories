// Which stored values of this session could not be decrypted — the count
// behind the app-wide notice (components/UnreadableContentNotice.jsx).
//
// utils/encryption.js reports here and goes on, so one damaged field shows as a
// missing field instead of failing its list. The notice is what keeps that
// from being silent: the screen a damaged document is on may not show the
// field at all, and before this a wrong key looked like base64 text.
//
// Counted by ciphertext, so the same field in five snapshots is one. Nothing
// decrypted is kept, there being nothing.
let unreadable = new Set()
// Replaced, never mutated, on every change: useSyncExternalStore compares it by
// identity. `generation` moves on each reset, so a notice dismissed in one
// session or family does not stay dismissed in the next.
let snapshot = { generation: 0, count: 0 }
const listeners = new Set()

function publish(next) {
  snapshot = next
  for (const listener of listeners) listener()
}

export function reportUnreadable(ciphertexts) {
  const before = unreadable.size
  for (const value of ciphertexts) unreadable.add(value)
  if (unreadable.size !== before) publish({ ...snapshot, count: unreadable.size })
}

export function unreadableSnapshot() {
  return snapshot
}

export function subscribeUnreadable(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** On logout and family switch, with the decrypted text cache. */
export function resetUnreadable() {
  if (unreadable.size === 0) return
  unreadable = new Set()
  publish({ generation: snapshot.generation + 1, count: 0 })
}

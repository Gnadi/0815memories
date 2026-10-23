/**
 * Just enough of the Admin SDK's Firestore for the media functions' unit
 * tests: documents by path, get/set, and transactions that apply their writes
 * only when the callback returns. The rules suites run the same functions
 * against the emulator.
 *
 * @param {Record<string, object>} [seed]  documents by path, e.g. { 'families/f': {…} }
 */
export function fakeAdminFirestore(seed = {}) {
  const docs = new Map(Object.entries(seed))
  const snapshot = (path) => ({
    exists: docs.has(path),
    data: () => (docs.has(path) ? { ...docs.get(path) } : undefined),
  })
  const ref = (path) => ({
    path,
    get: async () => snapshot(path),
    set: async (data) => { docs.set(path, { ...data }) },
  })

  return {
    docs,
    doc: ref,
    collection: (name) => ({ doc: (id) => ref(`${name}/${id}`) }),
    async runTransaction(fn) {
      const writes = []
      const tx = {
        get: async (r) => snapshot(r.path),
        set: (r, data) => { writes.push(() => docs.set(r.path, { ...data })) },
        update: (r, data) => {
          if (!docs.has(r.path)) throw new Error(`No document to update: ${r.path}`)
          writes.push(() => docs.set(r.path, { ...docs.get(r.path), ...data }))
        },
      }
      const result = await fn(tx)
      for (const write of writes) write()
      return result
    },
    /** The documents of one collection, by id. */
    collectionData(name) {
      return Object.fromEntries(
        [...docs].filter(([path]) => path.startsWith(`${name}/`)).map(([path, data]) => [path.slice(name.length + 1), data]),
      )
    },
  }
}

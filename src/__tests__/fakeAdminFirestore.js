/**
 * Just enough of the Admin SDK's Firestore for the media functions' unit
 * tests: documents by path, get/set, queries with `==` and `<=` and a limit,
 * and transactions that apply their writes only when the callback returns.
 * The rules suites run the same functions against the emulator.
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

  const comparable = (v) => (v instanceof Date ? v.getTime() : v)
  const matches = (data, [field, op, value]) => {
    const have = comparable(data[field])
    if (op === '==') return have === comparable(value)
    if (op === '<=') return have != null && have <= comparable(value)
    throw new Error(`Unsupported operator ${op}`)
  }
  const query = (name, filters = [], max = Infinity) => ({
    where: (field, op, value) => query(name, [...filters, [field, op, value]], max),
    limit: (n) => query(name, filters, n),
    get: async () => ({
      docs: [...docs]
        .filter(([path]) => path.startsWith(`${name}/`) && !path.slice(name.length + 1).includes('/'))
        .filter(([, data]) => filters.every((f) => matches(data, f)))
        .slice(0, max)
        .map(([path]) => ({ id: path.slice(name.length + 1), ...snapshot(path) })),
    }),
  })

  return {
    docs,
    doc: ref,
    collection: (name) => ({ ...query(name), doc: (id) => ref(`${name}/${id}`) }),
    async runTransaction(fn) {
      const writes = []
      const tx = {
        get: async (r) => snapshot(r.path),
        set: (r, data) => { writes.push(() => docs.set(r.path, { ...data })) },
        delete: (r) => { writes.push(() => docs.delete(r.path)) },
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

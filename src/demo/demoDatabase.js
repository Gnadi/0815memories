import { Timestamp } from 'firebase/firestore'

/**
 * The demo family's database: the part of the Firestore API Kaydo calls,
 * answered from memory.
 *
 * A demo tab never talks to Firebase. config/firestore.js hands every call to
 * the database made here instead, so hooks, pages and components run
 * unchanged against documents that live in this tab and are gone when it
 * closes or reloads.
 *
 * It is not an emulator. It knows the calls the app makes — references, the
 * `where` operators, `orderBy`, `limit`, `startAfter`, listeners, writes,
 * batches and transactions — and the part of firestore.rules a visitor would
 * notice missing: the time locks (see `readable`). Write rules are left out;
 * they keep families and devices from tampering with each other, and the demo
 * has one family in one tab. Anything it does not know throws, so a feature
 * that starts using more of Firestore fails loudly in the demo instead of
 * quietly showing nothing.
 */

const AUTO_ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

function autoId() {
  let id = ''
  for (let i = 0; i < 20; i++) id += AUTO_ID_CHARS[Math.floor(Math.random() * AUTO_ID_CHARS.length)]
  return id
}

// Shaped like a FirestoreError, which is all the app looks at.
function firestoreError(code, message) {
  const err = new Error(message)
  err.name = 'FirebaseError'
  err.code = code
  return err
}

// ── Values ──────────────────────────────────────────────────────────────────

class FieldValue {
  constructor(kind, items = []) {
    this.kind = kind
    this.items = items
  }
}

const DELETE = Symbol('delete')

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype

// A stored value, copied. Firestore hands every reader its own copy, and a
// component that mutates what it was given must not change the database.
function copy(value) {
  if (value instanceof Timestamp) return new Timestamp(value.seconds, value.nanoseconds)
  if (Array.isArray(value)) return value.map(copy)
  if (isPlainObject(value)) {
    const out = {}
    for (const [key, item] of Object.entries(value)) out[key] = copy(item)
    return out
  }
  return value
}

// What Firestore would store for a value the app writes. Dates become
// Timestamps, as they do on the way into Firestore; undefined is refused, as
// Firestore refuses it, so a write that would fail in production fails here.
function toStored(value, current, path) {
  if (value instanceof FieldValue) return resolveFieldValue(value, current, path)
  if (value === undefined) {
    throw firestoreError('invalid-argument', `Unsupported field value: undefined (found in field ${path})`)
  }
  if (value instanceof Date) return Timestamp.fromDate(value)
  if (value instanceof Timestamp) return copy(value)
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item instanceof FieldValue) {
        throw firestoreError('invalid-argument', `${item.kind}() cannot be used inside an array (field ${path})`)
      }
      return toStored(item, undefined, path)
    })
  }
  if (isPlainObject(value)) {
    const out = {}
    for (const [key, item] of Object.entries(value)) {
      const stored = toStored(item, undefined, `${path}.${key}`)
      if (stored !== DELETE) out[key] = stored
    }
    return out
  }
  return value
}

function resolveFieldValue(value, current, path) {
  switch (value.kind) {
    case 'serverTimestamp':
      return Timestamp.now()
    case 'deleteField':
      return DELETE
    case 'arrayUnion': {
      const result = Array.isArray(current) ? current.map(copy) : []
      for (const item of value.items) {
        if (!result.some((existing) => valuesEqual(existing, item))) result.push(toStored(item, undefined, path))
      }
      return result
    }
    case 'arrayRemove':
      return (Array.isArray(current) ? current : [])
        .filter((existing) => !value.items.some((item) => valuesEqual(existing, item)))
        .map(copy)
    default:
      throw firestoreError('unimplemented', `The demo database does not know ${value.kind}()`)
  }
}

// Firestore's cross-type order, for the types the app stores.
function typeRank(value) {
  if (value === null) return 0
  if (typeof value === 'boolean') return 1
  if (typeof value === 'number') return 2
  if (value instanceof Timestamp || value instanceof Date) return 3
  if (typeof value === 'string') return 4
  if (Array.isArray(value)) return 5
  return 6
}

function compareValues(a, b) {
  const rankA = typeRank(a)
  const rankB = typeRank(b)
  if (rankA !== rankB) return rankA - rankB
  if (rankA === 3) return millis(a) - millis(b)
  if (rankA === 5) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const order = compareValues(a[i], b[i])
      if (order !== 0) return order
    }
    return a.length - b.length
  }
  if (rankA === 6) return compareValues(JSON.stringify(signature(a)), JSON.stringify(signature(b)))
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

const millis = (value) => (value instanceof Timestamp ? value.toMillis() : value.getTime())

function valuesEqual(a, b) {
  if (typeRank(a) !== typeRank(b)) return false
  if (Array.isArray(a)) return a.length === b.length && a.every((item, i) => valuesEqual(item, b[i]))
  if (isPlainObject(a)) {
    const keys = Object.keys(a)
    return keys.length === Object.keys(b).length && keys.every((key) => key in b && valuesEqual(a[key], b[key]))
  }
  return compareValues(a, b) === 0
}

// A JSON-safe rendering of a value, used to tell whether a listener's answer
// changed. Firestore only calls a listener again when it did, and components
// that write in response to a snapshot depend on that.
function signature(value) {
  if (value instanceof Timestamp) return { $t: value.toMillis() }
  if (Array.isArray(value)) return value.map(signature)
  if (isPlainObject(value)) {
    const out = {}
    for (const key of Object.keys(value).sort()) out[key] = signature(value[key])
    return out
  }
  return value
}

function getField(data, fieldPath) {
  let node = data
  for (const key of fieldPath.split('.')) {
    if (!isPlainObject(node) || !(key in node)) return undefined
    node = node[key]
  }
  return node
}

// ── Paths and references ────────────────────────────────────────────────────

function splitPath(segments) {
  const parts = segments.flatMap((segment) => String(segment).split('/')).filter(Boolean)
  if (parts.length === 0) throw firestoreError('invalid-argument', 'Empty path')
  return parts
}

const parentPath = (path) => path.split('/').slice(0, -1).join('/')
const lastSegment = (path) => path.split('/').pop()

class DocumentReference {
  constructor(database, path) {
    this.type = 'document'
    this.firestore = database
    this.path = path
    this.id = lastSegment(path)
  }

  get parent() {
    return new CollectionReference(this.firestore, parentPath(this.path))
  }
}

class Query {
  constructor(database, path, constraints) {
    this.type = 'query'
    this.firestore = database
    this._collectionPath = path
    this._constraints = constraints
  }
}

class CollectionReference extends Query {
  constructor(database, path) {
    super(database, path, [])
    this.type = 'collection'
    this.path = path
    this.id = lastSegment(path)
  }

  get parent() {
    const parent = parentPath(this.path)
    return parent ? new DocumentReference(this.firestore, parent) : null
  }
}

// ── Snapshots ───────────────────────────────────────────────────────────────

const METADATA = Object.freeze({ hasPendingWrites: false, fromCache: false })

class DocumentSnapshot {
  constructor(database, path, data) {
    this.ref = new DocumentReference(database, path)
    this.id = this.ref.id
    this.metadata = METADATA
    this._data = data
  }

  exists() {
    return this._data !== undefined
  }

  data() {
    return this._data === undefined ? undefined : copy(this._data)
  }

  get(fieldPath) {
    return this._data === undefined ? undefined : copy(getField(this._data, fieldPath))
  }
}

class QuerySnapshot {
  constructor(database, query, entries) {
    this.query = query
    this.docs = entries.map(([path, data]) => new DocumentSnapshot(database, path, data))
    this.size = this.docs.length
    this.empty = this.docs.length === 0
    this.metadata = METADATA
  }

  forEach(callback) {
    this.docs.forEach(callback)
  }

  docChanges() {
    return this.docs.map((doc, newIndex) => ({ type: 'added', doc, oldIndex: -1, newIndex }))
  }
}

// ── Query evaluation ────────────────────────────────────────────────────────

function matchesFilter(data, { field, op, value }) {
  const actual = getField(data, field)
  // Firestore leaves a document without the field out of every filter,
  // `!=` and `not-in` included.
  if (actual === undefined) return false
  switch (op) {
    case '==':
      return valuesEqual(actual, value)
    case '!=':
      return actual !== null && !valuesEqual(actual, value)
    case '<':
    case '<=':
    case '>':
    case '>=': {
      // Range filters only ever match values of the same type.
      if (typeRank(actual) !== typeRank(value)) return false
      const order = compareValues(actual, value)
      if (op === '<') return order < 0
      if (op === '<=') return order <= 0
      if (op === '>') return order > 0
      return order >= 0
    }
    case 'array-contains':
      return Array.isArray(actual) && actual.some((item) => valuesEqual(item, value))
    case 'array-contains-any':
      return Array.isArray(actual) && actual.some((item) => value.some((wanted) => valuesEqual(item, wanted)))
    case 'in':
      return value.some((wanted) => valuesEqual(actual, wanted))
    case 'not-in':
      return actual !== null && !value.some((unwanted) => valuesEqual(actual, unwanted))
    default:
      throw firestoreError('unimplemented', `The demo database does not know the "${op}" filter`)
  }
}

function compareEntries(orders) {
  return ([pathA, dataA], [pathB, dataB]) => {
    for (const { field, direction } of orders) {
      const order = compareValues(getField(dataA, field), getField(dataB, field))
      if (order !== 0) return direction === 'desc' ? -order : order
    }
    // Firestore's final tiebreak is the document name.
    return pathA < pathB ? -1 : pathA > pathB ? 1 : 0
  }
}

function applyCursor(entries, cursor, orders) {
  if (cursor.snapshot) {
    const index = entries.findIndex(([path]) => path === cursor.snapshot.ref.path)
    return index === -1 ? entries : entries.slice(index + 1)
  }
  return entries.filter(([, data]) => {
    for (let i = 0; i < cursor.values.length && i < orders.length; i++) {
      const order = compareValues(getField(data, orders[i].field), cursor.values[i])
      if (order !== 0) return orders[i].direction === 'desc' ? order < 0 : order > 0
    }
    return false
  })
}

// ── The time locks from firestore.rules ─────────────────────────────────────

/**
 * Whether the visitor may read a document — the three rules that hold
 * something back until a date or a partner, mirrored from firestore.rules.
 * Everything else in the demo belongs to the visitor's own family.
 *
 * As in the rules, a document that does not exist is readable: the app
 * subscribes to entries and letters before they are written, and reads an
 * absent capsule letter as one that predates the split.
 */
function readable(documents, path, data, { uid, now }) {
  if (data === undefined) return true
  const [collectionName, id] = path.split('/')
  switch (collectionName) {
    case 'blackboxContent': {
      const unlockDate = documents.get(`blackbox/${id}`)?.unlockDate
      return unlockDate instanceof Timestamp && now >= unlockDate.toMillis()
    }
    case 'ourYearEntries':
      return (data.participantUids ?? []).includes(uid) && (data.authorUid === uid || data.revealed === true)
    case 'ourYearLetters':
      return (data.participantUids ?? []).includes(uid)
        && (data.sealedAt == null || (data.openAt instanceof Timestamp && now >= data.openAt.toMillis()))
    default:
      return true
  }
}

// ── The database ────────────────────────────────────────────────────────────

/**
 * @param {{ documents?: Iterable<[string, object]>, uid: string }} options
 *   `documents` — the starting content as [path, data] pairs; `uid` — who
 *   the visitor is, for the rules above.
 * @returns the functions config/firestore.js routes to, under the SDK's names.
 */
export function createDemoDatabase({ documents = [], uid }) {
  // path -> data. Stored values are never changed in place: a write replaces
  // them, so a copy of the map is a snapshot of the whole database.
  let store = new Map()
  const listeners = new Set()
  let notifyQueued = false

  const database = { type: 'firestore', demo: true }

  const deny = (path) =>
    firestoreError('permission-denied', `Missing or insufficient permissions (${path})`)

  function check(path, data) {
    if (!readable(store, path, data, { uid, now: Date.now() })) throw deny(path)
  }

  function readDocument(ref) {
    const data = store.get(ref.path)
    check(ref.path, data)
    return new DocumentSnapshot(database, ref.path, data)
  }

  function runQuery(query) {
    const filters = query._constraints.filter((c) => c.kind === 'where')
    const orders = query._constraints.filter((c) => c.kind === 'orderBy')
    const cursor = query._constraints.find((c) => c.kind === 'startAfter')
    const max = query._constraints.find((c) => c.kind === 'limit')

    let entries = [...store].filter(([path, data]) =>
      parentPath(path) === query._collectionPath
      && filters.every((filter) => matchesFilter(data, filter))
      // Ordering by a field leaves out documents that do not have it.
      && orders.every(({ field }) => getField(data, field) !== undefined))
    entries.sort(compareEntries(orders))
    if (cursor) entries = applyCursor(entries, cursor, orders)
    if (max) entries = entries.slice(0, max.count)
    // One unreadable result fails the whole query, as it does in Firestore.
    for (const [path, data] of entries) check(path, data)
    return entries
  }

  function read(target) {
    if (target instanceof DocumentReference) return readDocument(target)
    if (target instanceof Query) return new QuerySnapshot(database, target, runQuery(target))
    throw firestoreError('invalid-argument', 'Expected a document reference or a query')
  }

  function answerSignature(snapshot) {
    if (snapshot instanceof DocumentSnapshot) return JSON.stringify(signature(snapshot._data ?? null))
    return JSON.stringify(snapshot.docs.map((doc) => [doc.ref.path, signature(doc._data)]))
  }

  // Hands one listener the current answer, if it is new to it. A listener that
  // is refused is finished, as in Firestore.
  function deliver(listener) {
    if (!listener.active) return
    let snapshot
    try {
      snapshot = read(listener.target)
    } catch (err) {
      listener.active = false
      listeners.delete(listener)
      listener.error?.(err)
      return
    }
    const answer = answerSignature(snapshot)
    if (answer === listener.lastAnswer) return
    listener.lastAnswer = answer
    listener.next?.(snapshot)
  }

  function notifyListeners() {
    if (notifyQueued) return
    notifyQueued = true
    queueMicrotask(() => {
      notifyQueued = false
      for (const listener of [...listeners]) deliver(listener)
    })
  }

  // Applies a list of writes all at once, or none of them.
  function commit(writes) {
    const next = new Map(store)
    for (const write of writes) write(next)
    store = next
    notifyListeners()
  }

  function setWrite(ref, data, options = {}) {
    if (!isPlainObject(data)) throw firestoreError('invalid-argument', 'Document data must be an object')
    return (target) => {
      if (!options.merge) {
        for (const [key, value] of Object.entries(data)) {
          if (value instanceof FieldValue && value.kind === 'deleteField') {
            throw firestoreError('invalid-argument', `deleteField() needs { merge: true } (field ${key})`)
          }
        }
        target.set(ref.path, toStored(data, undefined, ref.path))
        return
      }
      const merged = copy(target.get(ref.path) ?? {})
      mergeInto(merged, data, ref.path)
      target.set(ref.path, merged)
    }
  }

  // set(..., { merge: true }): keys are field names, not paths, and maps merge
  // into the maps already there.
  function mergeInto(existing, patch, path) {
    for (const [key, value] of Object.entries(patch)) {
      if (isPlainObject(value)) {
        if (!isPlainObject(existing[key])) existing[key] = {}
        mergeInto(existing[key], value, `${path}.${key}`)
        continue
      }
      const stored = toStored(value, existing[key], `${path}.${key}`)
      if (stored === DELETE) delete existing[key]
      else existing[key] = stored
    }
  }

  function updateWrite(ref, fieldsOrPath, ...rest) {
    const fields = typeof fieldsOrPath === 'string'
      ? Object.fromEntries(pairs([fieldsOrPath, ...rest]))
      : fieldsOrPath
    if (!isPlainObject(fields)) throw firestoreError('invalid-argument', 'Update data must be an object')
    return (target) => {
      const current = target.get(ref.path)
      if (current === undefined) throw firestoreError('not-found', `No document to update: ${ref.path}`)
      const next = copy(current)
      // update(): keys are field paths, so 'keepsakes.song' reaches into a map.
      for (const [fieldPath, value] of Object.entries(fields)) {
        const keys = fieldPath.split('.')
        let node = next
        for (const key of keys.slice(0, -1)) {
          if (!isPlainObject(node[key])) node[key] = {}
          node = node[key]
        }
        const last = keys[keys.length - 1]
        const stored = toStored(value, node[last], fieldPath)
        if (stored === DELETE) delete node[last]
        else node[last] = stored
      }
      target.set(ref.path, next)
    }
  }

  const deleteWrite = (ref) => (target) => {
    target.delete(ref.path)
  }

  function pairs(list) {
    const out = []
    for (let i = 0; i < list.length; i += 2) out.push([list[i], list[i + 1]])
    return out
  }

  function constraint(kind, fields) {
    return { kind, ...fields }
  }

  const api = {
    collection(parent, ...segments) {
      const base = parent instanceof DocumentReference || parent instanceof CollectionReference ? [parent.path] : []
      const parts = splitPath([...base, ...segments])
      if (parts.length % 2 === 0) {
        throw firestoreError('invalid-argument', `Not a collection path: ${parts.join('/')}`)
      }
      return new CollectionReference(database, parts.join('/'))
    },

    doc(parent, ...segments) {
      if (parent instanceof CollectionReference && segments.length === 0) {
        return new DocumentReference(database, `${parent.path}/${autoId()}`)
      }
      const base = parent instanceof DocumentReference || parent instanceof CollectionReference ? [parent.path] : []
      const parts = splitPath([...base, ...segments])
      if (parts.length % 2 !== 0) {
        throw firestoreError('invalid-argument', `Not a document path: ${parts.join('/')}`)
      }
      return new DocumentReference(database, parts.join('/'))
    },

    query(base, ...constraints) {
      if (!(base instanceof Query)) throw firestoreError('invalid-argument', 'Expected a collection or a query')
      return new Query(database, base._collectionPath, [...base._constraints, ...constraints])
    },

    where: (field, op, value) => constraint('where', { field, op, value }),
    orderBy: (field, direction = 'asc') => constraint('orderBy', { field, direction }),
    limit: (count) => constraint('limit', { count }),
    startAfter: (...values) =>
      constraint('startAfter', values[0] instanceof DocumentSnapshot ? { snapshot: values[0] } : { values }),

    serverTimestamp: () => new FieldValue('serverTimestamp'),
    deleteField: () => new FieldValue('deleteField'),
    arrayUnion: (...items) => new FieldValue('arrayUnion', items),
    arrayRemove: (...items) => new FieldValue('arrayRemove', items),

    async getDoc(ref) {
      return readDocument(ref)
    },

    async getDocs(query) {
      return read(query)
    },

    async getCountFromServer(query) {
      const count = runQuery(query).length
      return { data: () => ({ count }) }
    },

    // onSnapshot(target, next, error) and the SDK's other shapes of it: an
    // observer object, or listen options in front of either.
    onSnapshot(target, ...args) {
      if (isPlainObject(args[0]) && typeof args[0].next !== 'function' && typeof args[0].error !== 'function') {
        args = args.slice(1)
      }
      const [first, second] = args
      const listener = typeof first === 'function'
        ? { target, next: first, error: second, active: true, lastAnswer: undefined }
        : { target, next: first?.next, error: first?.error, active: true, lastAnswer: undefined }
      listeners.add(listener)
      // The first answer arrives asynchronously, as it does from the SDK.
      queueMicrotask(() => deliver(listener))
      return () => {
        listener.active = false
        listeners.delete(listener)
      }
    },

    async setDoc(ref, data, options) {
      commit([setWrite(ref, data, options)])
    },

    async updateDoc(ref, ...args) {
      commit([updateWrite(ref, ...args)])
    },

    async deleteDoc(ref) {
      commit([deleteWrite(ref)])
    },

    async addDoc(collectionRef, data) {
      const ref = api.doc(collectionRef)
      commit([setWrite(ref, data)])
      return ref
    },

    writeBatch() {
      const writes = []
      const batch = {
        set(ref, data, options) {
          writes.push(setWrite(ref, data, options))
          return batch
        },
        update(ref, ...args) {
          writes.push(updateWrite(ref, ...args))
          return batch
        },
        delete(ref) {
          writes.push(deleteWrite(ref))
          return batch
        },
        async commit() {
          commit(writes)
        },
      }
      return batch
    },

    // Nothing else writes while the update function runs, so there is nothing
    // to retry: the reads it makes stay true until its writes are applied.
    async runTransaction(_database, updateFunction) {
      const writes = []
      const transaction = {
        get: async (ref) => readDocument(ref),
        set(ref, data, options) {
          writes.push(setWrite(ref, data, options))
          return transaction
        },
        update(ref, ...args) {
          writes.push(updateWrite(ref, ...args))
          return transaction
        },
        delete(ref) {
          writes.push(deleteWrite(ref))
          return transaction
        },
      }
      const result = await updateFunction(transaction)
      commit(writes)
      return result
    },
  }

  for (const [path, data] of documents) store.set(path, toStored(data, undefined, path))

  return api
}

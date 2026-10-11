// @vitest-environment node
/**
 * Deleting for good, on the server: functions/purge.js and
 * functions/familyDeletion.js.
 *
 * The lists of files to delete come from clients, so the one thing that must
 * hold is that a family's purge never deletes another family's files. A file
 * counts as the family's if it sits in the family's folder, or if it decrypts
 * with the family's key — checked here against files the app itself encrypted.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateEncryptionKey, encryptBlob } from '../utils/encryption'
import {
  TRASH_DAYS, cloudinaryAsset, deleteFiles, familyFiles, purgeDue, rawKey, sealedWith,
} from '../../functions/purge.js'
import {
  DeletionError, FAMILY_COLLECTIONS, runFamilyDeletion, startFamilyDeletion,
} from '../../functions/familyDeletion.js'

const CLOUD = 'kaydo'
const FAMILY = 'family-1'
const url = (publicId, type = 'raw') => `https://res.cloudinary.com/${CLOUD}/${type}/upload/v1712/${publicId}`
const DAY = 24 * 60 * 60 * 1000

// ── A stand-in for the Admin SDK's Firestore ─────────────────────────────────

const DELETE = Symbol('deleteField')

function fakeDb(initial = {}) {
  const docs = new Map(Object.entries(initial))
  const snap = (path) => ({
    id: path.split('/').pop(), exists: docs.has(path), data: () => docs.get(path), ref: ref(path),
  })
  const ref = (path) => ({
    path,
    get: async () => snap(path),
    delete: async () => { docs.delete(path) },
  })
  const matches = (value, op, expected) => (op === '==' ? value === expected : op === '<=' ? value <= expected : false)
  const query = (path, filters = [], max = Infinity) => ({
    where: (field, op, value) => query(path, [...filters, [field, op, value]], max),
    limit: (n) => query(path, filters, n),
    get: async () => {
      const depth = path.split('/').length + 1
      const found = [...docs.keys()]
        .filter((p) => p.startsWith(`${path}/`) && p.split('/').length === depth)
        .filter((p) => filters.every(([field, op, value]) => matches(docs.get(p)[field], op, value)))
        .slice(0, max)
      return { empty: !found.length, docs: found.map(snap) }
    },
  })
  return {
    docs,
    doc: ref,
    collection: (path) => query(path),
    batch() {
      const ops = []
      return {
        set: (r, data) => ops.push(() => docs.set(r.path, data)),
        update: (r, data) => ops.push(() => {
          const next = { ...docs.get(r.path) }
          for (const [field, value] of Object.entries(data)) {
            if (value === DELETE) delete next[field]
            else next[field] = value
          }
          docs.set(r.path, next)
        }),
        delete: (r) => ops.push(() => docs.delete(r.path)),
        commit: async () => ops.forEach((op) => op()),
      }
    },
  }
}

// ── Cloudinary, as the Admin API answers it ──────────────────────────────────

function fakeCloudinary() {
  const calls = []
  const api = {
    cloudName: CLOUD,
    apiKey: 'key',
    apiSecret: 'secret',
    fail: false,
    calls,
    fetch: vi.fn(async (endpoint, init) => {
      calls.push({ endpoint: new URL(endpoint), init })
      return api.fail ? { ok: false, status: 500 } : { ok: true, status: 200, json: async () => ({ partial: false }) }
    }),
  }
  return api
}

const deletedIds = (api) => api.calls.flatMap((c) => c.endpoint.searchParams.getAll('public_ids[]'))

// Files as the app writes them: encrypted in the browser with the family key.
// `globalThis.Buffer`: eslint gives files under src/ browser globals only.
let family
let stranger
async function sealedFile(key, text) {
  return globalThis.Buffer.from(await encryptBlob(key, new Blob([text])))
}

beforeEach(async () => {
  if (!family) {
    family = await generateEncryptionKey()
    stranger = await generateEncryptionKey()
  }
})

describe('cloudinaryAsset', () => {
  it("reads a file's type and public id from its URL", () => {
    expect(cloudinaryAsset(url('kaydo/encrypted/a.dat'), CLOUD)).toMatchObject({ resourceType: 'raw', publicId: 'kaydo/encrypted/a.dat' })
    // An image's public id has no extension; a raw file's keeps it.
    expect(cloudinaryAsset(url('kaydo/header.jpg', 'image'), CLOUD)).toMatchObject({ resourceType: 'image', publicId: 'kaydo/header' })
    expect(cloudinaryAsset(`https://res.cloudinary.com/${CLOUD}/raw/upload/kaydo/b.dat`, CLOUD).publicId).toBe('kaydo/b.dat')
  })

  it('takes nothing that is not a file on this account', () => {
    expect(cloudinaryAsset('https://res.cloudinary.com/someone-else/raw/upload/v1/a.dat', CLOUD)).toBeNull()
    expect(cloudinaryAsset('http://res.cloudinary.com/kaydo/raw/upload/v1/a.dat', CLOUD)).toBeNull()
    expect(cloudinaryAsset('https://example.com/kaydo/raw/upload/v1/a.dat', CLOUD)).toBeNull()
    expect(cloudinaryAsset('/seed-media/encrypted/a.dat', CLOUD)).toBeNull()
  })
})

describe('sealedWith', () => {
  it("knows the family's own files by its key, and no one else's", async () => {
    const bytes = await sealedFile(family.key, 'a family photo')
    expect(sealedWith(bytes, rawKey(family.jwk))).toBe(true)
    expect(sealedWith(bytes, rawKey(stranger.jwk))).toBe(false)
    const tampered = globalThis.Buffer.from(bytes)
    tampered[20] ^= 1
    expect(sealedWith(tampered, rawKey(family.jwk))).toBe(false)
  })
})

describe('familyFiles', () => {
  it("deletes the family's files and no one else's", async () => {
    const own = await sealedFile(family.key, 'ours')
    const theirs = await sealedFile(stranger.key, 'theirs')
    const bytes = { [url('kaydo/encrypted/ours.dat')]: own, [url('kaydo/encrypted/theirs.dat')]: theirs }
    const fetchBytes = vi.fn(async (u) => bytes[u] ?? null)

    const { owned, refused } = await familyFiles([
      url(`kaydo/f/${FAMILY}/encrypted/new.dat`),
      url('kaydo/encrypted/ours.dat'),
      url('kaydo/encrypted/theirs.dat'),
      url('kaydo/f/family-2/encrypted/foreign.dat'),
      url('kaydo/encrypted/gone.dat'),
      'https://example.com/elsewhere.jpg',
    ], { familyId: FAMILY, key: rawKey(family.jwk), cloudName: CLOUD, fetchBytes })

    expect(owned.map((a) => a.publicId)).toEqual([`kaydo/f/${FAMILY}/encrypted/new.dat`, 'kaydo/encrypted/ours.dat'])
    expect(refused).toEqual([
      url('kaydo/encrypted/theirs.dat'), url('kaydo/f/family-2/encrypted/foreign.dat'), 'https://example.com/elsewhere.jpg',
    ])
    // The family's own folder needs no download.
    expect(fetchBytes).not.toHaveBeenCalledWith(url(`kaydo/f/${FAMILY}/encrypted/new.dat`))
  })
})

describe('deleteFiles', () => {
  it('asks the Admin API a hundred files at a time, per type, as the account', async () => {
    const api = fakeCloudinary()
    const raw = Array.from({ length: 230 }, (_, i) => ({ resourceType: 'raw', publicId: `kaydo/f/x/${i}.dat` }))
    await deleteFiles([...raw, { resourceType: 'image', publicId: 'kaydo/f/x/public/header' }], api)

    expect(api.calls.map((c) => [c.endpoint.pathname, c.endpoint.searchParams.getAll('public_ids[]').length])).toEqual([
      ['/v1_1/kaydo/resources/raw/upload', 100],
      ['/v1_1/kaydo/resources/raw/upload', 100],
      ['/v1_1/kaydo/resources/raw/upload', 30],
      ['/v1_1/kaydo/resources/image/upload', 1],
    ])
    expect(api.calls[0].init).toEqual({ method: 'DELETE', headers: { Authorization: `Basic ${btoa('key:secret')}` } })
  })

  it('throws when refused, so the record stays for the next run', async () => {
    const api = fakeCloudinary()
    api.fail = true
    await expect(deleteFiles([{ resourceType: 'raw', publicId: 'a' }], api)).rejects.toThrow('500')
  })
})

describe('purgeDue', () => {
  const NOW = Date.UTC(2026, 9, 10)
  const entry = (id, fields) => ({ familyId: FAMILY, collection: 'memories', docId: id, group: `memories__${id}`, media: [], ...fields })

  async function setup() {
    const db = fakeDb({
      [`families/${FAMILY}`]: { encryptionKeyJwk: family.jwk },
      'trash/memories__old': entry('old', { deletedAt: new Date(NOW - (TRASH_DAYS + 1) * DAY), media: [url(`kaydo/f/${FAMILY}/encrypted/old.dat`)] }),
      'trash/memories__young': entry('young', { deletedAt: new Date(NOW - DAY), media: [url(`kaydo/f/${FAMILY}/encrypted/young.dat`)] }),
      'trash/memories__now': entry('now', { deletedAt: new Date(NOW - DAY), purgeNow: true, media: [url(`kaydo/f/${FAMILY}/encrypted/now.dat`)] }),
      'trash/blackbox__c1': entry('c1', { collection: 'blackbox', deletedAt: new Date(NOW - (TRASH_DAYS + 1) * DAY) }),
      'blackboxContent/c1': { familyId: FAMILY, message: 'ciphertext', photos: [url(`kaydo/f/${FAMILY}/encrypted/letter.dat`)] },
      'mediaDeletions/r1': { familyId: FAMILY, media: [url(`kaydo/f/${FAMILY}/encrypted/keepsake.dat`), url('kaydo/f/family-2/encrypted/x.dat')] },
    })
    return { db, api: fakeCloudinary() }
  }

  it('deletes what is due, with its files, and leaves the rest', async () => {
    const { db, api } = await setup()
    const totals = await purgeDue({ db, now: NOW, cloudinary: api, fetchBytes: async () => null })

    expect([...db.docs.keys()].sort()).toEqual([`families/${FAMILY}`, 'trash/memories__young'])
    expect(deletedIds(api).sort()).toEqual([
      `kaydo/f/${FAMILY}/encrypted/keepsake.dat`,
      `kaydo/f/${FAMILY}/encrypted/letter.dat`,
      `kaydo/f/${FAMILY}/encrypted/now.dat`,
      `kaydo/f/${FAMILY}/encrypted/old.dat`,
    ])
    expect(totals).toMatchObject({ entries: 3, requests: 1, files: 4, refused: 1, failed: 0 })
  })

  it('keeps everything for the next run when Cloudinary cannot be reached', async () => {
    const { db, api } = await setup()
    api.fail = true
    const totals = await purgeDue({ db, now: NOW, cloudinary: api, fetchBytes: async () => null })
    expect(db.docs.has('trash/memories__old')).toBe(true)
    expect(db.docs.has('blackboxContent/c1')).toBe(true)
    expect(db.docs.has('mediaDeletions/r1')).toBe(true)
    expect(totals.failed).toBe(4)
  })
})

describe('deleting a family', () => {
  function fakeAuth() {
    return {
      updateUser: vi.fn(async () => {}),
      revokeRefreshTokens: vi.fn(async () => {}),
      deleteUsers: vi.fn(async () => ({ successCount: 0, failureCount: 0, errors: [] })),
    }
  }

  function familyDb() {
    return fakeDb({
      [`families/${FAMILY}`]: {
        adminUid: 'owner', adminUids: ['owner', 'co-admin'], familySlug: 'the-millers', encryptionKeyJwk: family.jwk,
      },
      [`families/${FAMILY}/admins/co-admin`]: { email: 'co@example.com' },
      [`families/${FAMILY}/secrets/auth`]: { sharedPassword: 'hash' },
      [`familyPublic/${FAMILY}`]: { familyName: 'The Millers' },
      'familySlugs/the-millers': { familyId: FAMILY },
      'memories/m1': { familyId: FAMILY, images: [url('kaydo/encrypted/legacy-own.dat'), url('kaydo/encrypted/legacy-theirs.dat')] },
      'journals/j1': { familyId: FAMILY, photos: [url(`kaydo/f/${FAMILY}/encrypted/j.dat`)] },
      'feedback/f1': { familyId: FAMILY, message: 'Love it' },
      'memories/elsewhere': { familyId: 'family-2', images: [] },
      'families/family-2': { adminUid: 'someone' },
    })
  }

  it('is for the owner alone', async () => {
    const db = familyDb()
    const auth = fakeAuth()
    await expect(startFamilyDeletion({ db, auth, deleteField: () => DELETE }, 'co-admin', FAMILY))
      .rejects.toEqual(new DeletionError('permission-denied', 'Only the owner can delete the family'))
    expect(auth.updateUser).not.toHaveBeenCalled()
    expect(db.docs.get(`families/${FAMILY}`).encryptionKeyJwk).toEqual(family.jwk)
  })

  it('locks everyone out and takes the key off the family document at once', async () => {
    const db = familyDb()
    const auth = fakeAuth()
    await startFamilyDeletion({ db, auth, deleteField: () => DELETE }, 'owner', FAMILY)

    expect(auth.updateUser.mock.calls).toEqual([
      ['owner', { disabled: true }], ['co-admin', { disabled: true }], [`viewer:${FAMILY}`, { disabled: true }],
    ])
    expect(db.docs.get(`families/${FAMILY}`).encryptionKeyJwk).toBeUndefined()
    expect(db.docs.get(`familyDeletions/${FAMILY}`)).toMatchObject({ key: family.jwk, uids: ['owner', 'co-admin', `viewer:${FAMILY}`] })
  })

  it("deletes all of it, files included, and none of another family's", async () => {
    const db = familyDb()
    const auth = fakeAuth()
    const api = fakeCloudinary()
    const files = {
      [url('kaydo/encrypted/legacy-own.dat')]: await sealedFile(family.key, 'ours'),
      [url('kaydo/encrypted/legacy-theirs.dat')]: await sealedFile(stranger.key, 'theirs'),
    }
    const bucket = { deleteFiles: vi.fn(async () => {}) }
    await startFamilyDeletion({ db, auth, deleteField: () => DELETE }, 'owner', FAMILY)

    const done = await runFamilyDeletion(db.docs.get(`familyDeletions/${FAMILY}`), {
      db, auth, bucket, cloudinary: api, fetchBytes: async (u) => files[u] ?? null,
    })

    expect(done).toBe(true)
    expect([...db.docs.keys()].sort()).toEqual(['families/family-2', 'memories/elsewhere'])
    expect(deletedIds(api).sort()).toEqual(['kaydo/encrypted/legacy-own.dat', `kaydo/f/${FAMILY}/encrypted/j.dat`])
    expect(api.calls.filter((c) => c.endpoint.searchParams.get('prefix') === `kaydo/f/${FAMILY}/`)).toHaveLength(3)
    expect(bucket.deleteFiles).toHaveBeenCalledWith({ prefix: `printFiles/${FAMILY}/` })
    expect(auth.deleteUsers).toHaveBeenCalledWith(['owner', 'co-admin', `viewer:${FAMILY}`])
  })

  it('picks up where a run that ran out of time stopped', async () => {
    const db = familyDb()
    const auth = fakeAuth()
    await startFamilyDeletion({ db, auth, deleteField: () => DELETE }, 'owner', FAMILY)
    const record = db.docs.get(`familyDeletions/${FAMILY}`)
    const deps = { db, auth, cloudinary: fakeCloudinary(), fetchBytes: async () => null }

    expect(await runFamilyDeletion(record, { ...deps, deadline: Date.now() - 1 })).toBe(false)
    expect(db.docs.has(`familyDeletions/${FAMILY}`)).toBe(true)
    expect(await runFamilyDeletion(record, deps)).toBe(true)
    expect(db.docs.has(`familyDeletions/${FAMILY}`)).toBe(false)
  })

  it('knows every collection a family has documents in', () => {
    // A collection added to firestore.rules with a familyId must be added to
    // FAMILY_COLLECTIONS too, or deleted families leave it behind.
    expect(FAMILY_COLLECTIONS).toEqual(expect.arrayContaining([
      'memories', 'moments', 'children', 'journals', 'blackbox', 'blackboxContent', 'recipes', 'scrapbooks',
      'collages', 'highlights', 'ourYearRituals', 'ourYearChapters', 'ourYearEntries', 'ourYearLetters', 'trash',
      'mediaDeletions', 'fcmTokens', 'feedback',
    ]))
  })
})

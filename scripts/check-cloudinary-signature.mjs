#!/usr/bin/env node
/**
 * Does an upload signature from signUpload hold only for the resource type it
 * was made for?
 *
 * functions/mediaSigning.js signs `overwrite`, `public_id`, `tags` and
 * `timestamp`. The resource type (`raw` for family content) is not among them:
 * it is only the path of the upload URL. If Cloudinary leaves the path out of
 * the signature too, a signature made for an encrypted `raw` file also uploads
 * a plain `image` or `video` under the same public_id — outside the ledger's
 * idea of the file, its size lookup and its clean-up, and under another type's
 * size limit. This script finds out, against a Cloudinary account of its own.
 *
 * It signs with the real signUpload (only Firestore is replaced, by a map in
 * memory), posts each upload the way src/utils/uploadSignature.js does, and
 * reports what Cloudinary answered. Then it lists what the test family's tag
 * turned up under each resource type, and deletes it.
 *
 *   ONLY EVER WITH A TEST ACCOUNT. It uploads files and deletes by tag. Use a
 *   free Cloudinary account made for this, never the one Kaydo runs on.
 *
 * Usage:
 *   CLOUDINARY_TEST_CLOUD_NAME=… CLOUDINARY_TEST_API_KEY=… CLOUDINARY_TEST_API_SECRET=… \
 *     node scripts/check-cloudinary-signature.mjs --test-account [--size] [--keep] [--out result.json]
 *
 *   --test-account  required: you confirm the credentials are a test account's
 *   --size          also send a file over the 10 MB raw limit, as raw and as video
 *   --keep          leave the uploaded files in the account
 *   --out <file>    write the results as JSON
 *   --dry-run       sign and print the requests, send nothing (no credentials needed)
 *
 * Reading the result: `signature-rejected` (Cloudinary answers 401 or names the
 * signature) on every non-raw case means the suspicion is unfounded.
 * `accepted`, or `signature-accepted` with Cloudinary refusing only the file,
 * on any of them means it holds. Node 22 or later (fetch, FormData, Blob).
 */
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { signUpload } from '../functions/mediaSigning.js'

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const option = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const DRY_RUN = flag('--dry-run')
const CLOUD = process.env.CLOUDINARY_TEST_CLOUD_NAME || (DRY_RUN ? 'dry-run-cloud' : '')
const API_KEY = process.env.CLOUDINARY_TEST_API_KEY || (DRY_RUN ? 'dry-run-key' : '')
const SECRET = process.env.CLOUDINARY_TEST_API_SECRET || (DRY_RUN ? 'dry-run-secret' : '')

function fail(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}

if (!DRY_RUN) {
  if (!flag('--test-account')) {
    fail('Pass --test-account to confirm the credentials belong to a Cloudinary account made for this test.')
  }
  if (!CLOUD || !API_KEY || !SECRET) {
    fail('Set CLOUDINARY_TEST_CLOUD_NAME, CLOUDINARY_TEST_API_KEY and CLOUDINARY_TEST_API_SECRET.')
  }
  // The production cloud name is configured for the client in .env files; a
  // match means these are not test credentials.
  for (const file of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    if (!existsSync(file)) continue
    const match = /^VITE_CLOUDINARY_CLOUD_NAME=(.*)$/m.exec(readFileSync(file, 'utf8'))
    if (match && match[1].trim() === CLOUD) fail(`${file} names ${CLOUD} as the app's cloud. Use a test account.`)
  }
}

// ── Signing, exactly as the signUpload function does ────────────────────────

const FAMILY = `sigcheck-${randomBytes(4).toString('hex')}`
const UID = 'sigcheck-admin'

/** Just what signUpload reads and writes: a family document and a transaction. */
function memoryDb() {
  const docs = new Map([[`families/${FAMILY}`, { adminUid: UID, adminUids: [UID] }]])
  const ref = (path) => ({
    path,
    get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }),
  })
  return {
    doc: ref,
    collection: (name) => ({ doc: (id) => ref(`${name}/${id}`) }),
    runTransaction: async (fn) => fn({
      get: (r) => r.get(),
      set: (r, data) => docs.set(r.path, data),
    }),
  }
}

const deps = {
  db: memoryDb(),
  apiKey: API_KEY,
  secret: SECRET,
  limits: { uploadsPerHour: 1000, familyBytes: Number.MAX_SAFE_INTEGER, maxFileBytes: 100 * 1024 * 1024 },
}

const sign = () => signUpload(deps, UID, { familyId: FAMILY, kind: 'encrypted' })

// ── Files ───────────────────────────────────────────────────────────────────

// A real 1×1 PNG, so an image endpoint has no reason to refuse the file itself.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
)
const files = {
  ciphertext: () => new Blob([randomBytes(256)], { type: 'application/octet-stream' }),
  png: () => new Blob([PNG], { type: 'image/png' }),
  // Not a playable video. Cloudinary checks the signature before the file, so
  // refusing it as a video still says the signature passed.
  notAVideo: () => new Blob([randomBytes(256)], { type: 'video/mp4' }),
  big: () => new Blob([randomBytes(11 * 1024 * 1024)], { type: 'application/octet-stream' }),
}

// ── Uploading, exactly as src/utils/uploadSignature.js does ─────────────────

const uploadUrl = (resourceType) => `https://api.cloudinary.com/v1_1/${CLOUD}/${resourceType}/upload`

function uploadForm(file, filename, signed) {
  const form = new FormData()
  form.append('file', file, filename)
  for (const [key, value] of Object.entries(signed.params)) form.append(key, String(value))
  form.append('api_key', signed.apiKey)
  form.append('signature', signed.signature)
  return form
}

function classify(status, body, header) {
  const message = body?.error?.message || header || ''
  if (status >= 200 && status < 300) return { verdict: 'accepted', message: body?.existing ? 'already existed' : '' }
  if (status === 401 || /signature/i.test(message)) return { verdict: 'signature-rejected', message }
  return { verdict: 'signature-accepted', message: `file refused: ${message || status}` }
}

async function upload(name, resourceType, file, filename, signed) {
  const entry = { case: name, endpoint: resourceType, publicId: signed.publicId, signedFor: signed.resourceType }
  if (DRY_RUN) {
    console.log(`[dry-run] POST ${uploadUrl(resourceType)}  ${JSON.stringify({ ...signed.params, signature: signed.signature })}`)
    return { ...entry, verdict: 'dry-run' }
  }
  const response = await fetch(uploadUrl(resourceType), { method: 'POST', body: uploadForm(file, filename, signed) })
  const body = await response.json().catch(() => null)
  const result = classify(response.status, body, response.headers.get('x-cld-error'))
  return {
    ...entry,
    status: response.status,
    ...result,
    storedAs: body?.resource_type ?? null,
    bytes: body?.bytes ?? null,
  }
}

// ── Admin API: what the test family's tag holds, and clearing it ────────────

const auth = `Basic ${Buffer.from(`${API_KEY}:${SECRET}`).toString('base64')}`

async function taggedResources(resourceType) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUD}/resources/${resourceType}/tags/${encodeURIComponent(`family:${FAMILY}`)}?max_results=100`
  const response = await fetch(url, { headers: { Authorization: auth } })
  if (!response.ok) return []
  const body = await response.json()
  return (body.resources ?? []).map((r) => r.public_id)
}

async function deleteResources(resourceType, publicIds) {
  if (publicIds.length === 0) return
  const query = publicIds.map((id) => `public_ids[]=${encodeURIComponent(id)}`).join('&')
  await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/resources/${resourceType}/upload?${query}`, {
    method: 'DELETE',
    headers: { Authorization: auth },
  })
}

// ── The cases ───────────────────────────────────────────────────────────────

const results = []
const run = async (...a) => {
  const result = await upload(...a)
  results.push(result)
  const detail = [result.status, result.storedAs && `stored as ${result.storedAs}`, result.message].filter(Boolean).join(' · ')
  console.log(`${result.verdict.padEnd(20)} ${result.case}  (${detail})`)
  return result
}

console.log(`Cloud ${CLOUD}, test family ${FAMILY}${DRY_RUN ? ', dry run' : ''}\n`)

// 1. The control: what the app does. Has to be accepted, or nothing below means anything.
const control = await sign()
await run('control: raw signature at /raw', 'raw', files.ciphertext(), 'encrypted.dat', control)

// 2. A fresh raw signature at every other endpoint.
await run('raw signature at /image', 'image', files.png(), 'test.png', await sign())
await run('raw signature at /video', 'video', files.notAVideo(), 'test.mp4', await sign())
await run('raw signature at /auto', 'auto', files.png(), 'test.png', await sign())

// 3. The control's signature, used a second time: as an image, and as raw again.
await run('used signature again at /image', 'image', files.png(), 'test.png', control)
await run('used signature again at /raw', 'raw', files.ciphertext(), 'encrypted.dat', control)

// 4. Optional: the 10 MB raw cap, and whether /video gets around it.
if (flag('--size')) {
  await run('11 MB at /raw', 'raw', files.big(), 'big.dat', await sign())
  await run('11 MB at /video', 'video', files.big(), 'big.mp4', await sign())
}

// ── What is in the account now, and the verdict ─────────────────────────────

let found = {}
if (!DRY_RUN) {
  for (const type of ['raw', 'image', 'video']) found[type] = await taggedResources(type)
  console.log('\nUnder the test family\'s tag:')
  for (const [type, ids] of Object.entries(found)) console.log(`  ${type.padEnd(5)} ${ids.length} file(s)`)
}

const crossType = results.filter((r) => r.signedFor === 'raw' && r.endpoint !== 'raw')
const holds = crossType.some((r) => r.verdict === 'accepted' || r.verdict === 'signature-accepted')
const verdict = DRY_RUN
  ? 'dry run: nothing was sent'
  : results[0].verdict !== 'accepted'
    ? `inconclusive: the control upload was not accepted (${results[0].message || results[0].status})`
    : holds
      ? 'CONFIRMED: a raw signature is accepted at another resource type'
      : 'NOT CONFIRMED: every other resource type rejected the raw signature'
console.log(`\n${verdict}`)

if (option('--out')) {
  writeFileSync(option('--out'), JSON.stringify({ cloud: CLOUD, family: FAMILY, at: new Date().toISOString(), verdict, results, found }, null, 2))
  console.log(`Results written to ${option('--out')}`)
}

if (!DRY_RUN && !flag('--keep')) {
  for (const [type, ids] of Object.entries(found)) await deleteResources(type, ids)
  console.log('Test files deleted.')
}

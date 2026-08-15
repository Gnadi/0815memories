import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { decryptFields, decryptJSON, decryptBlob } from './encryption'
import { MEMORY_WRITE_FIELDS } from '../hooks/useMemories'
import { collectRichMediaUrls, parseRichDoc } from './richText'

/**
 * Recursively convert Firestore Timestamps to ISO strings.
 */
function serializeTimestamps(obj) {
  if (obj == null) return obj
  if (typeof obj !== 'object') return obj
  if (typeof obj.toDate === 'function') return obj.toDate().toISOString()
  if (Array.isArray(obj)) return obj.map(serializeTimestamps)
  const result = {}
  for (const [key, value] of Object.entries(obj)) {
    result[key] = serializeTimestamps(value)
  }
  return result
}

/**
 * Infer file extension from a URL path.
 */
function getExtensionFromUrl(url) {
  try {
    const pathname = new URL(url).pathname
    const match = pathname.match(/\.(\w{2,5})$/)
    if (match) return '.' + match[1].toLowerCase()
  } catch {
    // ignore
  }
  return ''
}

/**
 * Fetch a collection filtered by familyId.
 */
async function fetchCollection(collectionName, familyId, orderField = 'createdAt', orderDir = 'desc') {
  const q = query(
    collection(db, collectionName),
    where('familyId', '==', familyId),
    orderBy(orderField, orderDir)
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...serializeTimestamps(d.data()) }))
}

/**
 * Collect all media URLs from documents, returning { url, zipPath } entries.
 */
function collectMediaUrls(data, prefix) {
  const entries = []

  function addUrl(url, docId, name) {
    if (!url || typeof url !== 'string') return
    const ext = getExtensionFromUrl(url) || '.bin'
    entries.push({ url, zipPath: `media/${prefix}/${docId}/${name}${ext}` })
  }

  function addArrayUrls(arr, docId, fieldPrefix) {
    if (!Array.isArray(arr)) return
    arr.forEach((item, i) => {
      if (typeof item === 'string') {
        addUrl(item, docId, `${fieldPrefix}-${i}`)
      } else if (item && item.url) {
        addUrl(item.url, docId, `${fieldPrefix}-${i}`)
      }
    })
  }

  for (const doc of data) {
    switch (prefix) {
      case 'memories':
        addArrayUrls(doc.images, doc.id, 'image')
        addUrl(doc.imageUrl, doc.id, 'hero')
        addArrayUrls(doc.videos, doc.id, 'video')
        addArrayUrls(doc.voiceMemos, doc.id, 'voicememo')
        // Media living inside the rich description is not in any of the arrays
        // above; without this a backup would quietly lose it. Safe here because
        // collectMediaUrls runs after decryptCollectionData has parsed the
        // document. Originals only — thumbnails are not exported either.
        collectRichMediaUrls(doc.contentRich).forEach((m, i) =>
          addUrl(m.url, doc.id, `inline-${m.kind}-${i}`)
        )
        break
      case 'moments':
        addArrayUrls(doc.images, doc.id, 'image')
        addArrayUrls(doc.videos, doc.id, 'video')
        break
      case 'journals':
        addArrayUrls(doc.photos, doc.id, 'photo')
        addArrayUrls(doc.videos, doc.id, 'video')
        addArrayUrls(doc.voiceMemos, doc.id, 'voicememo')
        break
      case 'children':
        addUrl(doc.profilePhoto, doc.id, 'profile')
        break
      case 'recipes':
        addUrl(doc.image, doc.id, 'image')
        break
      case 'blackbox':
        addArrayUrls(doc.photos, doc.id, 'photo')
        addArrayUrls(doc.videos, doc.id, 'video')
        addUrl(doc.voiceNote?.url, doc.id, 'voicenote')
        break
      // The next three keep their photos inside an encrypted JSON blob, which
      // decryptCollectionData has already parsed by the time this runs.
      case 'scrapbooks':
        // pages[].elements[] — photo elements carry `url`, empty slots do not.
        for (const page of doc.pages ?? []) {
          addArrayUrls(page?.elements?.filter((el) => el?.url), doc.id, 'photo')
        }
        break
      case 'collages':
        addArrayUrls(doc.doc?.slots?.filter((s) => s?.url), doc.id, 'photo')
        break
      case 'highlights':
        // Originals only, as everywhere else — `thumbUrl` is a derivative.
        addArrayUrls(doc.doc?.shots?.filter((s) => s?.url), doc.id, 'shot')
        break
      case 'ourYearChapters':
        // keepsakes: one photo slot per chapter, alongside song/quote/moment.
        for (const keepsake of Object.values(doc.keepsakes ?? {})) {
          addUrl(keepsake?.url, doc.id, 'keepsake')
        }
        break
    }
  }

  return entries
}

/**
 * Download media blobs with concurrency limit.
 */
async function downloadMedia(mediaEntries, onProgress, signal, encKey, concurrency = 4) {
  const results = []
  const failed = []
  let completed = 0
  const total = mediaEntries.length

  async function downloadOne(entry) {
    try {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      const response = await fetch(entry.url, { signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      let blob = await response.blob()
      // Decrypt encrypted media blobs
      if (encKey) {
        try {
          const buffer = await blob.arrayBuffer()
          blob = await decryptBlob(encKey, buffer, blob.type || 'application/octet-stream')
        } catch {
          // If decryption fails, file may not be encrypted - use as-is
        }
      }
      results.push({ zipPath: entry.zipPath, blob })
    } catch (err) {
      if (err.name === 'AbortError') throw err
      failed.push({ url: entry.url, zipPath: entry.zipPath, error: err.message })
    } finally {
      completed++
      onProgress({
        phase: 'media',
        current: completed,
        total,
        message: `Downloading file ${completed} of ${total}...`,
      })
    }
  }

  // Process in batches
  for (let i = 0; i < mediaEntries.length; i += concurrency) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const batch = mediaEntries.slice(i, i + concurrency)
    await Promise.all(batch.map(downloadOne))
  }

  return { results, failed }
}

/**
 * Run a full NAS export: fetch all data, download media, build ZIP, trigger download.
 */
/**
 * Decrypt all text fields for exported data collections.
 */
async function decryptCollectionData(data, collectionName, encryptionKey) {
  if (!encryptionKey) return data
  const fieldMap = {
    memories: MEMORY_WRITE_FIELDS,
    journals: ['content'],
    children: ['name'],
    blackbox: ['title', 'message'],
    recipes: ['title', 'description', 'instructions', 'chefNote', 'forkReason', 'author'],
    scrapbooks: ['title'],
    collages: ['title'],
    highlights: ['title'],
    ourYearRituals: [],
    ourYearChapters: ['title'],
    ourYearEntries: [],
    ourYearLetters: [],
  }
  // Fields holding an encrypted JSON blob rather than a string, per collection.
  const jsonFieldMap = {
    recipes: ['ingredients'],
    scrapbooks: ['pages'],
    collages: ['doc'],
    highlights: ['doc'],
    ourYearRituals: ['partners'],
    ourYearChapters: ['quizQuestions', 'quizReactions', 'keepsakes'],
    ourYearEntries: ['answers'],
    ourYearLetters: ['sections'],
  }
  const fields = fieldMap[collectionName]
  if (!fields) return data
  const jsonFields = jsonFieldMap[collectionName] ?? []
  return Promise.all(data.map(async (item) => {
    let decrypted = await decryptFields(encryptionKey, item, fields)
    for (const field of jsonFields) {
      if (typeof decrypted[field] === 'string') {
        decrypted[field] = await decryptJSON(encryptionKey, decrypted[field])
      }
    }
    // The rich description is decrypted by the field list above; parse it so the
    // export writes a readable document and collectMediaUrls can walk it.
    if (collectionName === 'memories' && decrypted.contentRich != null) {
      decrypted.contentRich = parseRichDoc(decrypted.contentRich)
    }
    return decrypted
  }))
}

/**
 * Attach each capsule's letter, now that a capsule is two documents.
 *
 * A sealed capsule's content document is unreadable by design — firestore.rules
 * withholds it until the unlock date — so it exports as metadata with `sealed:
 * true` and no letter. That is the correct behaviour rather than a gap: an
 * export must not be a way around the seal.
 *
 * Pre-split capsules still carry their payload inline, and are left as they are.
 */
async function attachCapsuleContents(capsules, encryptionKey) {
  return Promise.all(capsules.map(async (capsule) => {
    if (capsule.message != null || capsule.photos != null) return capsule
    try {
      const snap = await getDoc(doc(db, 'blackboxContent', capsule.id))
      if (!snap.exists()) return { ...capsule, sealed: false }
      const raw = serializeTimestamps(snap.data())
      const [content] = await decryptCollectionData([raw], 'blackbox', encryptionKey)
      const { familyId: _dropped, ...letter } = content
      return { ...capsule, ...letter, sealed: false }
    } catch {
      // Still sealed. Say so in the export instead of writing an empty capsule
      // that reads like data loss.
      return { ...capsule, sealed: true }
    }
  }))
}

/**
 * Everything belonging to the "Our Year" ritual the signed-in person is part of.
 *
 * Scoped to them, not to the family: these documents are readable by exactly two
 * people, and the other eleven collections are family-wide. Two consequences
 * worth stating —
 *
 *  - Entries are fetched by author. A list mixing a revealed answer with the
 *    partner's unrevealed one is denied wholesale, so asking for both would
 *    return nothing rather than half.
 *  - A letter still sealed stays sealed. Same reasoning as a capsule.
 */
async function fetchOurYear(familyId, uid, encryptionKey) {
  if (!uid) return { rituals: [], chapters: [], entries: [], letters: [] }

  const ritualSnap = await getDocs(query(
    collection(db, 'ourYearRituals'),
    where('participantUids', 'array-contains', uid),
  ))
  const rituals = ritualSnap.docs
    .map((d) => ({ id: d.id, ...serializeTimestamps(d.data()) }))
    .filter((r) => r.familyId === familyId)
  if (rituals.length === 0) return { rituals: [], chapters: [], entries: [], letters: [] }

  const chapterSnap = await getDocs(query(
    collection(db, 'ourYearChapters'),
    where('participantUids', 'array-contains', uid),
  ))
  const ritualIds = new Set(rituals.map((r) => r.id))
  const chapters = chapterSnap.docs
    .map((d) => ({ id: d.id, ...serializeTimestamps(d.data()) }))
    .filter((c) => ritualIds.has(c.ritualId))

  const entrySnap = await getDocs(query(
    collection(db, 'ourYearEntries'),
    where('authorUid', '==', uid),
  ))
  const chapterIds = new Set(chapters.map((c) => c.id))
  const entries = entrySnap.docs
    .map((d) => ({ id: d.id, ...serializeTimestamps(d.data()) }))
    .filter((e) => chapterIds.has(e.chapterId))

  const letters = []
  for (const chapter of chapters) {
    try {
      const snap = await getDoc(doc(db, 'ourYearLetters', chapter.id))
      if (snap.exists()) letters.push({ id: snap.id, ...serializeTimestamps(snap.data()) })
    } catch {
      letters.push({ id: chapter.id, chapterId: chapter.id, sealed: true })
    }
  }

  const [decRituals, decChapters, decEntries, decLetters] = await Promise.all([
    decryptCollectionData(rituals, 'ourYearRituals', encryptionKey),
    decryptCollectionData(chapters, 'ourYearChapters', encryptionKey),
    decryptCollectionData(entries, 'ourYearEntries', encryptionKey),
    decryptCollectionData(letters, 'ourYearLetters', encryptionKey),
  ])
  return { rituals: decRituals, chapters: decChapters, entries: decEntries, letters: decLetters }
}

export async function runNasExport({ familyId, familyName, uid, encryptionKey, onProgress, signal }) {
  if (!familyId || !db) throw new Error('Not authenticated')

  const dateStr = new Date().toISOString().slice(0, 10)
  const rootFolder = `Kaydo-Export-${dateStr}`

  // Phase 1: Fetch all Firestore data
  onProgress({ phase: 'data', current: 0, total: 1, message: 'Fetching family data...' })

  const [
    memories, moments, journals, children, blackbox, recipes,
    scrapbooks, collages, highlights, familySnap,
  ] = await Promise.all([
    fetchCollection('memories', familyId, 'date', 'desc'),
    fetchCollection('moments', familyId, 'date', 'desc'),
    fetchCollection('journals', familyId, 'date', 'desc'),
    fetchCollection('children', familyId, 'createdAt', 'asc'),
    fetchCollection('blackbox', familyId, 'createdAt', 'desc'),
    fetchCollection('recipes', familyId, 'createdAt', 'desc'),
    fetchCollection('scrapbooks', familyId, 'createdAt', 'desc'),
    fetchCollection('collages', familyId, 'createdAt', 'desc'),
    fetchCollection('highlights', familyId, 'createdAt', 'desc'),
    getDoc(doc(db, 'families', familyId)),
  ])

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  // Decrypt text fields
  const [
    decMemories, decJournals, decChildren, capsuleMetadata, decRecipes,
    decScrapbooks, decCollages, decHighlights, ourYear,
  ] = await Promise.all([
    decryptCollectionData(memories, 'memories', encryptionKey),
    decryptCollectionData(journals, 'journals', encryptionKey),
    decryptCollectionData(children, 'children', encryptionKey),
    decryptCollectionData(blackbox, 'blackbox', encryptionKey),
    decryptCollectionData(recipes, 'recipes', encryptionKey),
    decryptCollectionData(scrapbooks, 'scrapbooks', encryptionKey),
    decryptCollectionData(collages, 'collages', encryptionKey),
    decryptCollectionData(highlights, 'highlights', encryptionKey),
    fetchOurYear(familyId, uid, encryptionKey),
  ])
  const decMoments = moments // moments have no encrypted text fields
  const decBlackbox = await attachCapsuleContents(capsuleMetadata, encryptionKey)

  // Sanitize family doc (strip sensitive fields)
  let familyData = {}
  if (familySnap.exists()) {
    const raw = serializeTimestamps(familySnap.data())
    // Underscore-prefixed so the lint rule reads these as deliberately discarded
    // rather than forgotten. The family key especially must never leave here.
    const { sharedPassword: _pw, adminUid: _admin, encryptionKeyJwk: _key, ...safe } = raw
    familyData = { id: familyId, ...safe }
  }

  onProgress({ phase: 'data', current: 1, total: 1, message: 'Family data fetched.' })

  // Phase 2: Collect and download media (use original URLs for download, not decrypted text)
  const allMedia = [
    ...collectMediaUrls(decMemories, 'memories'),
    ...collectMediaUrls(decMoments, 'moments'),
    ...collectMediaUrls(decJournals, 'journals'),
    ...collectMediaUrls(decChildren, 'children'),
    ...collectMediaUrls(decRecipes, 'recipes'),
    ...collectMediaUrls(decBlackbox, 'blackbox'),
    ...collectMediaUrls(decScrapbooks, 'scrapbooks'),
    ...collectMediaUrls(decCollages, 'collages'),
    ...collectMediaUrls(decHighlights, 'highlights'),
    ...collectMediaUrls(ourYear.chapters, 'ourYearChapters'),
  ]

  // Deduplicate by URL
  const seen = new Set()
  const uniqueMedia = allMedia.filter((entry) => {
    if (seen.has(entry.url)) return false
    seen.add(entry.url)
    return true
  })

  let failedDownloads = []
  let mediaResults = []

  if (uniqueMedia.length > 0) {
    onProgress({
      phase: 'media',
      current: 0,
      total: uniqueMedia.length,
      message: `Downloading ${uniqueMedia.length} media files...`,
    })
    const result = await downloadMedia(uniqueMedia, onProgress, signal, encryptionKey)
    mediaResults = result.results
    failedDownloads = result.failed
  }

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  // Phase 3: Build ZIP
  onProgress({ phase: 'zip', current: 0, total: 1, message: 'Building ZIP archive...' })

  const zip = new JSZip()
  const root = zip.folder(rootFolder)

  // Manifest
  const manifest = {
    exportDate: new Date().toISOString(),
    familyName: familyName || familyData.familyName || 'Unknown',
    counts: {
      memories: decMemories.length,
      moments: decMoments.length,
      journals: decJournals.length,
      children: decChildren.length,
      blackbox: decBlackbox.length,
      recipes: decRecipes.length,
      scrapbooks: decScrapbooks.length,
      collages: decCollages.length,
      highlights: decHighlights.length,
      ourYearChapters: ourYear.chapters.length,
      mediaFiles: mediaResults.length,
      failedDownloads: failedDownloads.length,
    },
    // Capsules and letters that were still sealed when this export ran. They are
    // present as metadata without their contents — deliberately, since an export
    // must not be a way around the seal. Re-export after they open.
    stillSealed: {
      capsules: decBlackbox.filter((c) => c.sealed).map((c) => c.id),
      ourYearLetters: ourYear.letters.filter((l) => l.sealed).map((l) => l.id),
    },
    failedDownloads,
  }

  root.file('manifest.json', JSON.stringify(manifest, null, 2))

  // Data JSONs
  const dataFolder = root.folder('data')
  dataFolder.file('memories.json', JSON.stringify(decMemories, null, 2))
  dataFolder.file('moments.json', JSON.stringify(decMoments, null, 2))
  dataFolder.file('journals.json', JSON.stringify(decJournals, null, 2))
  dataFolder.file('children.json', JSON.stringify(decChildren, null, 2))
  dataFolder.file('blackbox.json', JSON.stringify(decBlackbox, null, 2))
  dataFolder.file('recipes.json', JSON.stringify(decRecipes, null, 2))
  dataFolder.file('scrapbooks.json', JSON.stringify(decScrapbooks, null, 2))
  dataFolder.file('collages.json', JSON.stringify(decCollages, null, 2))
  dataFolder.file('highlights.json', JSON.stringify(decHighlights, null, 2))
  dataFolder.file('family.json', JSON.stringify(familyData, null, 2))

  // Our Year belongs to two people rather than the family, so it gets its own
  // folder and is written only when the person exporting is one of them.
  if (ourYear.rituals.length > 0) {
    const ourYearFolder = root.folder('data/our-year')
    ourYearFolder.file('rituals.json', JSON.stringify(ourYear.rituals, null, 2))
    ourYearFolder.file('chapters.json', JSON.stringify(ourYear.chapters, null, 2))
    ourYearFolder.file('entries.json', JSON.stringify(ourYear.entries, null, 2))
    ourYearFolder.file('letters.json', JSON.stringify(ourYear.letters, null, 2))
  }

  // Media files
  for (const { zipPath, blob } of mediaResults) {
    root.file(zipPath, blob)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  saveAs(zipBlob, `${rootFolder}.zip`)

  onProgress({ phase: 'done', current: 1, total: 1, message: 'Export complete!' })
}

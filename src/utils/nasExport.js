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
    memories: ['title', 'content', 'quote', 'location', 'authorName', 'category'],
    journals: ['content'],
    children: ['name'],
    blackbox: ['content'],
    recipes: ['title', 'description', 'instructions', 'chefNote', 'forkReason', 'author'],
    scrapbooks: ['title'],
  }
  const fields = fieldMap[collectionName]
  if (!fields) return data
  return Promise.all(data.map(async (item) => {
    let decrypted = await decryptFields(encryptionKey, item, fields)
    // Handle JSON-encoded fields
    if (collectionName === 'recipes' && typeof decrypted.ingredients === 'string') {
      decrypted.ingredients = await decryptJSON(encryptionKey, decrypted.ingredients)
    }
    if (collectionName === 'scrapbooks' && typeof decrypted.pages === 'string') {
      decrypted.pages = await decryptJSON(encryptionKey, decrypted.pages)
    }
    return decrypted
  }))
}

export async function runNasExport({ familyId, familyName, encryptionKey, onProgress, signal }) {
  if (!familyId || !db) throw new Error('Not authenticated')

  const dateStr = new Date().toISOString().slice(0, 10)
  const rootFolder = `FamilyHearth-Export-${dateStr}`

  // Phase 1: Fetch all Firestore data
  onProgress({ phase: 'data', current: 0, total: 1, message: 'Fetching family data...' })

  const [memories, moments, journals, children, blackbox, recipes, familySnap] = await Promise.all([
    fetchCollection('memories', familyId, 'date', 'desc'),
    fetchCollection('moments', familyId, 'date', 'desc'),
    fetchCollection('journals', familyId, 'date', 'desc'),
    fetchCollection('children', familyId, 'createdAt', 'asc'),
    fetchCollection('blackbox', familyId, 'createdAt', 'desc'),
    fetchCollection('recipes', familyId, 'createdAt', 'desc'),
    getDoc(doc(db, 'families', familyId)),
  ])

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  // Decrypt text fields
  const [decMemories, decMoments, decJournals, decChildren, decBlackbox, decRecipes] = await Promise.all([
    decryptCollectionData(memories, 'memories', encryptionKey),
    Promise.resolve(moments), // moments have no encrypted text fields
    decryptCollectionData(journals, 'journals', encryptionKey),
    decryptCollectionData(children, 'children', encryptionKey),
    decryptCollectionData(blackbox, 'blackbox', encryptionKey),
    decryptCollectionData(recipes, 'recipes', encryptionKey),
  ])

  // Sanitize family doc (strip sensitive fields)
  let familyData = {}
  if (familySnap.exists()) {
    const raw = serializeTimestamps(familySnap.data())
    const { sharedPassword, adminUid, encryptionKeyJwk, ...safe } = raw
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
      mediaFiles: mediaResults.length,
      failedDownloads: failedDownloads.length,
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
  dataFolder.file('family.json', JSON.stringify(familyData, null, 2))

  // Media files
  for (const { zipPath, blob } of mediaResults) {
    root.file(zipPath, blob)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  saveAs(zipBlob, `${rootFolder}.zip`)

  onProgress({ phase: 'done', current: 1, total: 1, message: 'Export complete!' })
}

import { decryptBlob } from './encryption'
import { devWarn } from './devLog'

/**
 * A small pool of workers that decrypt media off the main thread.
 *
 * A feed full of photos means megabytes of AES-GCM per screen. On the main
 * thread that lands as long tasks between frames, which is what scrolling
 * felt like. The bytes are transferred both ways, so nothing is copied.
 *
 * Every failure path falls back to decrypting on the main thread: no Worker
 * (the SSG pre-render runs in Node), construction throws, a job errors. The
 * fallback is the code that ran before this file existed, so the worst case is
 * today's behaviour.
 */

const MAX_WORKERS = 3

let workers = null
let nextWorker = 0
let nextJobId = 1
let keyedWith = null

function createWorkers() {
  const count = Math.max(
    1,
    Math.min(MAX_WORKERS, (globalThis.navigator?.hardwareConcurrency ?? 4) - 1)
  )

  return Array.from({ length: count }, () => {
    const worker = new Worker(new URL('./decryptWorker.js', import.meta.url), { type: 'module' })
    const pending = new Map()

    worker.onmessage = (event) => {
      const { id, plaintext, error } = event.data
      const job = pending.get(id)
      if (!job) return
      pending.delete(id)
      if (error) job.reject(new Error(error))
      else job.resolve(plaintext)
    }
    worker.onerror = () => {
      for (const job of pending.values()) job.reject(new Error('Worker crashed'))
      pending.clear()
      // Drop the pool so the next call rebuilds it — or, if construction is
      // broken on this browser, quietly settles on the main-thread path.
      workers = null
      keyedWith = null
    }

    return { worker, pending }
  })
}

function ensureWorkers() {
  if (workers) return workers
  if (typeof Worker === 'undefined') return null
  try {
    workers = createWorkers()
  } catch (err) {
    devWarn('Decrypt workers unavailable, falling back to the main thread:', err)
    workers = null
  }
  return workers
}

/**
 * Decrypt into a Blob. `encryptedBuffer` is consumed — it is transferred to the
 * worker and left detached — so callers must not reuse it afterwards.
 */
export async function decryptBlobOffThread(key, encryptedBuffer, mimeType) {
  const pool = ensureWorkers()
  if (!pool) return decryptBlob(key, encryptedBuffer, mimeType)

  // Hand the key over once per key, not once per job.
  if (keyedWith !== key) {
    for (const { worker } of pool) worker.postMessage({ type: 'key', key })
    keyedWith = key
  }

  const entry = pool[nextWorker++ % pool.length]
  const id = nextJobId++

  try {
    const plaintext = await new Promise((resolve, reject) => {
      entry.pending.set(id, { resolve, reject })
      entry.worker.postMessage({ type: 'decrypt', id, buffer: encryptedBuffer }, [encryptedBuffer])
    })
    return new Blob([plaintext], { type: mimeType })
  } catch (err) {
    entry.pending.delete(id)
    // The buffer is detached now, so there is nothing left to retry with here;
    // useDecryptedMedia surfaces this the same way it always has.
    throw err
  }
}

/** Tear the pool down — used on logout alongside the media cache reset. */
export function terminateDecryptPool() {
  if (!workers) return
  for (const { worker } of workers) worker.terminate()
  workers = null
  keyedWith = null
}

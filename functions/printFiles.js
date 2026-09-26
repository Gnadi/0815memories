/**
 * Print files: the unencrypted PDFs of scrapbooks ordered as printed books from
 * Peecho, and their cover pictures (src/utils/printUpload.js writes them).
 *
 * They exist so Peecho can fetch the book when the order goes into production,
 * which happens within days of the order. Keeping them any longer would only
 * keep unencrypted copies of a family's photos lying around, so they are
 * deleted after a fixed time whether or not anyone ordered.
 *
 * Nothing here imports firebase-admin: the bucket comes in as an argument, so
 * the test suite can hand in a stand-in.
 */

export const PRINT_FILES_PREFIX = 'printFiles/'

/** Mirrored by PRINT_FILE_RETENTION_DAYS in src/utils/printBook.js, which tells the admin. */
export const PRINT_FILE_RETENTION_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Delete every print file older than the retention period.
 *
 * A file whose creation time cannot be read is left alone — deleting it is
 * irreversible, and the next run gets another look.
 *
 * @param {{ getFiles: (options: object) => Promise<[Array<{ name: string, metadata?: { timeCreated?: string }, delete: () => Promise<unknown> }>]> }} bucket
 * @param {number} [now]
 * @returns {Promise<{ checked: number, deleted: number, failed: number }>}
 */
export async function purgeExpiredPrintFiles(bucket, now = Date.now()) {
  const cutoff = now - PRINT_FILE_RETENTION_DAYS * DAY_MS
  const [files] = await bucket.getFiles({ prefix: PRINT_FILES_PREFIX })
  const expired = files.filter((file) => {
    const created = Date.parse(file.metadata?.timeCreated ?? '')
    return Number.isFinite(created) && created < cutoff
  })
  const results = await Promise.allSettled(expired.map((file) => file.delete()))
  const failed = results.filter((r) => r.status === 'rejected').length
  return { checked: files.length, deleted: expired.length - failed, failed }
}

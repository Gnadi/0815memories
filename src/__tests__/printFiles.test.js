/**
 * The daily clean-up of print files — functions/printFiles.js.
 *
 * These are the one unencrypted copy of a family's photos Kaydo keeps, and the
 * order dialog promises they are gone after PRINT_FILE_RETENTION_DAYS. They
 * must go on time, and nothing else may go with them.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  purgeExpiredPrintFiles,
  PRINT_FILES_PREFIX,
  PRINT_FILE_RETENTION_DAYS,
} from '../../functions/printFiles.js'
import { PRINT_FILE_RETENTION_DAYS as PROMISED_DAYS } from '../utils/printBook'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-09-26T03:30:00Z')

function file(name, ageDays, { fails = false } = {}) {
  return {
    name,
    metadata: { timeCreated: ageDays == null ? undefined : new Date(NOW - ageDays * DAY).toISOString() },
    delete: vi.fn(() => (fails ? Promise.reject(new Error('gone wrong')) : Promise.resolve())),
  }
}

function bucketOf(files) {
  return { getFiles: vi.fn(async () => [files]) }
}

describe('purgeExpiredPrintFiles', () => {
  it('keeps the retention period the order dialog promises', () => {
    expect(PRINT_FILE_RETENTION_DAYS).toBe(PROMISED_DAYS)
  })

  it('looks only under printFiles/', async () => {
    const bucket = bucketOf([])
    await purgeExpiredPrintFiles(bucket, NOW)
    expect(bucket.getFiles).toHaveBeenCalledWith({ prefix: PRINT_FILES_PREFIX })
    expect(PRINT_FILES_PREFIX).toBe('printFiles/')
  })

  it('deletes files past the retention period and keeps the rest', async () => {
    const old = file('printFiles/f/a/book.pdf', PRINT_FILE_RETENTION_DAYS + 1)
    const oldCover = file('printFiles/f/a/cover.jpg', PRINT_FILE_RETENTION_DAYS + 1)
    const young = file('printFiles/f/b/book.pdf', PRINT_FILE_RETENTION_DAYS - 1)
    const result = await purgeExpiredPrintFiles(bucketOf([old, oldCover, young]), NOW)

    expect(old.delete).toHaveBeenCalled()
    expect(oldCover.delete).toHaveBeenCalled()
    expect(young.delete).not.toHaveBeenCalled()
    expect(result).toEqual({ checked: 3, deleted: 2, failed: 0 })
  })

  // Irreversible either way, so the doubtful case keeps the file for another day.
  it('leaves a file alone whose creation time it cannot read', async () => {
    const unknown = file('printFiles/f/c/book.pdf', null)
    await purgeExpiredPrintFiles(bucketOf([unknown]), NOW)
    expect(unknown.delete).not.toHaveBeenCalled()
  })

  it('carries on past a file that fails to delete, and counts it', async () => {
    const stuck = file('printFiles/f/d/book.pdf', 90, { fails: true })
    const fine = file('printFiles/f/e/book.pdf', 90)
    const result = await purgeExpiredPrintFiles(bucketOf([stuck, fine]), NOW)
    expect(fine.delete).toHaveBeenCalled()
    expect(result).toEqual({ checked: 2, deleted: 1, failed: 1 })
  })
})

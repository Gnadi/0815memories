/**
 * Asking the server for leave to upload a print file.
 *
 * storage.rules only let a file land in a folder the reservePrintUpload Cloud
 * Function has issued (functions/printReservations.js), and it issues a limited
 * number per family so the shared bucket cannot be filled from one account.
 */
import { callFunction } from './callable'

/** Thrown when the family has used its print uploads for now. Mirrors the function's `resource-exhausted`. */
export class PrintQuotaError extends Error {
  constructor() {
    super('This family has used its print uploads for now')
    this.code = 'print-quota'
  }
}

/** @returns {Promise<{ printId: string, expiresAt: string }>} */
export async function reservePrintUpload(familyId) {
  try {
    const answer = await callFunction('reservePrintUpload', { familyId })
    if (!answer?.printId) throw new Error('No print upload came back')
    return answer
  } catch (error) {
    if (error?.code === 'functions/resource-exhausted') throw new PrintQuotaError()
    throw error
  }
}

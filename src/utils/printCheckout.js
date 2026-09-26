/**
 * Asking the createPrintCheckout Cloud Function for a Peecho checkout link
 * (functions/peechoCheckout.js). The Peecho API key stays with the function;
 * the browser only names the print file it uploaded.
 */
import { functions } from '../config/firebase'

/** @returns {Promise<{ checkoutUrl: string, expiresAt: string }>} */
export async function createPrintCheckout({ familyId, printId, pageCount, format, currency, language, title }) {
  if (!functions) throw new Error('Firebase is not configured')
  const { httpsCallable } = await import('firebase/functions')
  const call = httpsCallable(functions, 'createPrintCheckout')
  const { data } = await call({
    familyId,
    printId,
    pageCount,
    widthMm: format.widthMm,
    heightMm: format.heightMm,
    currency: currency || undefined,
    language,
    title,
  })
  if (!data?.checkoutUrl || !/^https:\/\/([a-z0-9-]+\.)*peecho\.com\//.test(data.checkoutUrl)) {
    throw new Error('No checkout link came back')
  }
  return data
}

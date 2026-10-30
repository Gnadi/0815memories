/**
 * Reads the usage log (src/services/usage.js) and prints, per family, how far
 * it got, what it used and where it stopped.
 *
 *   node scripts/usage-report.mjs [--days 30]
 *
 * The collection can only be read server-side, so this needs the Admin SDK's
 * credentials for the project you want to read (GOOGLE_APPLICATION_CREDENTIALS
 * and GOOGLE_CLOUD_PROJECT), or FIRESTORE_EMULATOR_HOST to try it on the
 * emulator. Run it yourself; nothing in the repo does.
 */
import { summarizeUsage, formatReport } from './usageReport.mjs'

const days = Number(process.argv[process.argv.indexOf('--days') + 1]) || 30
const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

const { initializeApp } = await import('firebase-admin/app')
const { getFirestore, Timestamp } = await import('firebase-admin/firestore')

initializeApp(process.env.GOOGLE_CLOUD_PROJECT ? { projectId: process.env.GOOGLE_CLOUD_PROJECT } : undefined)
const db = getFirestore()

const snapshot = await db.collection('usageEvents')
  .where('createdAt', '>=', Timestamp.fromDate(since))
  .orderBy('createdAt')
  .get()

const events = snapshot.docs.map((d) => {
  const data = d.data()
  return { ...data, createdAt: data.createdAt.toDate() }
})

// Family names are not secret from the operator and make the report readable.
const names = {}
for (const id of new Set(events.map((e) => e.familyId))) {
  const family = await db.collection('families').doc(id).get()
  names[id] = family.data()?.familyName
}

process.stdout.write(formatReport(summarizeUsage(events), { names, since }))

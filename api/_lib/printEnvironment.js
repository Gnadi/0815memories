/**
 * Which pieces of the print setup are configured, and which are missing.
 *
 * Ordering touches four settings across three places — a merchant key, a
 * project id, a storage bucket, and the provider mode — and a missing one
 * surfaces far from its cause: no bucket means the browser's upload fails with
 * "storage unavailable" and the order endpoint answers "misconfigured", neither
 * of which names the variable to set. Discovering them one failure at a time is
 * the slow way to configure something.
 *
 * So the selftest reports all of them at once. It reports *presence*, never
 * values: knowing that a merchant key is set is what the operator needs, and
 * the key itself is the one thing this endpoint must never say out loud. The
 * bucket name is the exception — it ships in the browser bundle already, so
 * showing it costs nothing and is the fastest way to catch the case where the
 * server and the app disagree about which bucket they mean.
 */

const PRESENT = (value) => !!String(value || '').trim()

export function describeEnvironment() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET

  const checks = {
    merchantApiKey: {
      ok: PRESENT(process.env.PEECHO_MERCHANT_API_KEY),
      variable: 'PEECHO_MERCHANT_API_KEY',
      needed: 'Every call to the print network. Without it nothing here works.',
    },
    projectId: {
      ok: PRESENT(projectId),
      variable: 'FIREBASE_PROJECT_ID (or VITE_FIREBASE_PROJECT_ID)',
      needed: 'Verifying the caller’s Firebase ID token. Without it every request is 500.',
      value: projectId || null,
    },
    storageBucket: {
      ok: PRESENT(storageBucket),
      variable: 'FIREBASE_STORAGE_BUCKET (or VITE_FIREBASE_STORAGE_BUCKET)',
      needed: 'Checking that a print file really belongs to the ordering family, '
        + 'and letting the browser upload it at all. Must be the bucket name exactly '
        + 'as the Firebase console shows it, e.g. <project>.firebasestorage.app.',
      value: storageBucket || null,
    },
  }

  const missing = Object.values(checks).filter((c) => !c.ok).map((c) => c.variable)

  return { ok: missing.length === 0, missing, checks }
}

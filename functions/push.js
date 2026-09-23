/**
 * The decisions behind a push, separated from the sending.
 *
 * Nothing here imports firebase-admin, so the app's test suite can cover the
 * two rules that actually decide whether a family keeps receiving
 * notifications: which language a device gets, and which failure means a token
 * is dead rather than merely unlucky.
 */

/** German is the fallback: it is what the app ships with. */
export const normalizeLang = (value) =>
  String(value || '').toLowerCase().startsWith('en') ? 'en' : 'de'

/** Every fixed notification the server can send, in both languages. */
export const COPY = {
  memory: {
    de: { title: '📷 Neue Erinnerung', body: 'Es wurde gerade eine neue Erinnerung geteilt.' },
    en: { title: '📷 New memory', body: 'Someone just shared a new memory.' },
  },
  moment: {
    de: { title: '✨ Neuer Moment', body: 'Es wurde gerade ein neuer Moment geteilt.' },
    en: { title: '✨ New moment', body: 'Someone just shared a new moment.' },
  },
}

/** The anniversary text needs the counts, so it is built rather than looked up. */
export function anniversaryCopy(lang, count, year) {
  if (normalizeLang(lang) === 'en') {
    return {
      title: '📷 Three years ago today…',
      body: `You have ${count} ${count === 1 ? 'memory' : 'memories'} from ${year}.`,
    }
  }
  return {
    title: '📷 3 Jahre ist es her…',
    body: `Du hast ${count} ${count === 1 ? 'Erinnerung' : 'Erinnerungen'} vom ${year}.`,
  }
}

/**
 * Only these mean the token is gone for good. Everything else — quota,
 * UNAVAILABLE, a timeout — is FCM having a bad minute, and the previous
 * dispatcher deleted on those too: one hiccup silently unsubscribed a
 * perfectly healthy phone that nobody would think to re-enable.
 */
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
])

export const isDeadToken = (code) => DEAD_TOKEN_CODES.has(code)

/**
 * Split token documents by the language their device reads. The server writes
 * the notification text, so it has to send one message per language.
 *
 * @param {Array<{ data: () => { token?: string, lang?: string, uid?: string|null } }>} docs
 * @param {{ excludeUid?: string|null }} [options]
 * @returns {Map<'de'|'en', Array>} in insertion order, empty groups omitted
 */
export function groupTokensByLang(docs, { excludeUid = null } = {}) {
  const byLang = new Map()
  for (const doc of docs) {
    const data = doc.data() || {}
    if (!data.token) continue
    // The author's own device stays quiet. Viewers share one identity
    // (`viewer:<familyId>`), but viewers cannot create anything either.
    if (excludeUid && data.uid === excludeUid) continue
    const lang = normalizeLang(data.lang)
    if (!byLang.has(lang)) byLang.set(lang, [])
    byLang.get(lang).push(doc)
  }
  return byLang
}

/** FCM accepts 500 tokens per multicast call. */
export const MULTICAST_CHUNK = 500

export const chunk = (items, size) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size))

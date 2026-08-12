/**
 * The single source of truth for every user-visible push notification text.
 *
 * Imported by both the browser (as the list of valid `kind` values) and
 * `api/send-push.js`, which builds the actual payload server-side. The client
 * never sends finished text — it sends a `kind` plus structured parameters, and
 * the endpoint turns that into words.
 *
 * Two reasons the text lives here and not at the call site:
 *
 * 1. Privacy. Memory titles are end-to-end encrypted (`MEMORY_TEXT_FIELDS` in
 *    useMemories.js). Putting one into a push payload would hand it to Firestore
 *    and Google in plaintext, which is exactly what the encryption exists to
 *    prevent. Every message below is generic — the details are behind the tap.
 * 2. Language. The recipient's language, not the sender's, decides the wording,
 *    so the text can only be resolved at send time, per device token.
 */

export const PUSH_KINDS = ['memory', 'moment', 'anniversary']

const DEFAULT_LANG = 'de'
const SUPPORTED_LANGS = ['de', 'en']

const MESSAGES = {
  memory: {
    de: () => ({ title: 'Neue Erinnerung', body: 'Eine neue Erinnerung wurde geteilt.' }),
    en: () => ({ title: 'New memory', body: 'A new memory was shared.' }),
  },
  moment: {
    de: () => ({ title: 'Neuer Moment', body: 'Ein neuer Moment ist im Feed.' }),
    en: () => ({ title: 'New moment', body: 'A new moment was added to the feed.' }),
  },
  anniversary: {
    // Wording preserved verbatim from the previous queue payload so the
    // notification users already know does not change.
    de: ({ count, year }) => ({
      title: '📷 3 Jahre ist es her…',
      body: `Du hast ${count} ${count === 1 ? 'Erinnerung' : 'Erinnerungen'} vom ${year}.`,
    }),
    en: ({ count, year }) => ({
      title: '📷 3 years ago today…',
      body: `You have ${count} ${count === 1 ? 'memory' : 'memories'} from ${year}.`,
    }),
  },
}

// Where tapping the notification takes the recipient. The memory id is the only
// parameter that reaches a URL, and it is a Firestore document id — no free text.
const URLS = {
  memory: ({ memoryId }) => (memoryId ? `/memory/${memoryId}` : '/timeline'),
  moment: () => '/',
  anniversary: () => '/timeline?filter=onthisday',
}

export function normalizeLang(lang) {
  // i18n resolves regional variants (de-AT, en-GB) down to the base language,
  // but a token written by an older client may still carry anything at all.
  const base = typeof lang === 'string' ? lang.slice(0, 2).toLowerCase() : ''
  return SUPPORTED_LANGS.includes(base) ? base : DEFAULT_LANG
}

/**
 * Builds one notification payload.
 *
 * @param {string} kind    — one of PUSH_KINDS
 * @param {string} lang    — recipient's language; anything unknown falls back to German
 * @param {object} [params] — { memoryId } for 'memory', { count, year } for 'anniversary'
 * @returns {{title: string, body: string, url: string} | null} null for an unknown kind
 */
export function buildPushMessage(kind, lang, params = {}) {
  const variants = MESSAGES[kind]
  if (!variants) return null

  const { title, body } = variants[normalizeLang(lang)](params)
  return { title, body, url: URLS[kind](params) }
}

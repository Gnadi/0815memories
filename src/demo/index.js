/**
 * Starting the demo family in a tab that is in demo mode (demo/demoMode.js).
 *
 * AuthContext loads this module only then, so nothing of the demo — the
 * database, the family, its words in two languages — reaches anyone else.
 * The pictures are plain files under public/demo-media/, fetched only when a
 * demo page shows them.
 */
import i18n from '../i18n'
import { installDemoDatabase } from '../config/firestore'
import { createDemoDatabase } from './demoDatabase'
import { buildDemoFamily, DEMO_FAMILY_ID } from './demoFamily'

let started = null

/**
 * Install the demo database, filled with a freshly built family, and say who
 * the visitor is. Built once per page load and then handed out again —
 * StrictMode runs AuthContext's effect twice in development.
 *
 * The family speaks the language the app is in when the demo starts. It is
 * sample content, not interface, so switching languages later leaves it as
 * it is; a reload builds it again in the new language.
 */
export function startDemo() {
  started ??= Promise.resolve().then(() => {
    const language = (i18n.resolvedLanguage || i18n.language || 'en').startsWith('de') ? 'de' : 'en'
    const { documents, visitor } = buildDemoFamily({ language, now: new Date() })
    installDemoDatabase(createDemoDatabase({ documents, uid: visitor.uid }))
    return { user: demoUser(visitor), familyId: DEMO_FAMILY_ID }
  })
  return started
}

// The parts of a Firebase User the app reads. The claims are the ones the
// syncAdminClaims function would put on a real admin's token; AuthContext asks
// for them again when a read is refused.
function demoUser({ uid, name, email }) {
  const claims = { role: 'admin', familyId: DEMO_FAMILY_ID }
  return {
    uid,
    displayName: name,
    email,
    emailVerified: true,
    isAnonymous: false,
    getIdToken: async () => 'demo',
    getIdTokenResult: async () => ({ claims, token: 'demo' }),
  }
}

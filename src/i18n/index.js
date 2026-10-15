// i18next setup for Kaydo.
//
// The public shell — landing page, login, signup, invite redemption — is
// imported statically so that:
//   1. the vite-react-ssg Node pre-render of "/" is fully synchronous — the
//      static HTML is emitted with real strings, never empty placeholders;
//   2. the PWA keeps working offline without caching extra translation files.
//
// Everything the signed-in app needs lives in ./appTranslations and is fetched
// on demand. Statically importing all 14 namespaces in both languages put
// 162 KB of raw JSON in front of the login form, most of it for screens the
// visitor had not reached — `legal`, `ourYear`, `settings` and `recipes` alone
// were more than half of it.
//
// `react: { useSuspense: false }` is required for the same SSG reason: it lets
// useTranslation() return a ready `t()` on the first synchronous render in Node.
// It also means a missing namespace renders as raw keys rather than suspending,
// which is why lazy pages must await ensureAppTranslations() before they mount
// (see lazyPage() in App.jsx) instead of loading namespaces from inside a hook.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enCommon from '../locales/en/common.json'
import enLanding from '../locales/en/landing.json'
import enAuth from '../locales/en/auth.json'

import deCommon from '../locales/de/common.json'
import deLanding from '../locales/de/landing.json'
import deAuth from '../locales/de/auth.json'

// Loaded before first paint: the public pages and the globally mounted chrome
// (bottom nav, install/notification prompts, error screen) use only these.
export const EAGER_NAMESPACES = ['common', 'landing', 'auth']

// Loaded with the first protected route.
export const LAZY_NAMESPACES = [
  'home', 'memory', 'journal', 'blackbox', 'recipes', 'scrapbook',
  'collage', 'timeline', 'ourYear', 'settings', 'emotions', 'legal',
  'feedback', 'sky', 'demo', 'bestOf',
]

export const NAMESPACES = [...EAGER_NAMESPACES, ...LAZY_NAMESPACES]
export const SUPPORTED_LANGUAGES = ['en', 'de']

// The landing page's address in each language. Crawlers detect no language,
// and most of them run no JavaScript, so a language reaches them only at an
// address of its own, pre-rendered in it (src/prerenderedRoutes.js). "/" is
// English to them and the visitor's language to everyone else; "/de" is German
// to all. index.html's inline script names these paths too.
export const LANDING_PATHS = { en: '/', de: '/de' }

// A visit that starts on "/de" is in German whatever the visitor's settings
// say. "/" names no language of its own.
const landingPath = {
  name: 'landingPath',
  lookup() {
    if (typeof window === 'undefined') return undefined
    return SUPPORTED_LANGUAGES.find(
      (lng) => LANDING_PATHS[lng] !== '/' && LANDING_PATHS[lng] === window.location.pathname,
    )
  },
}
const languageDetector = new LanguageDetector()
languageDetector.addDetector(landingPath)

export const resources = {
  en: { common: enCommon, landing: enLanding, auth: enAuth },
  de: { common: deCommon, landing: deLanding, auth: deAuth },
}

let appTranslationsPromise = null

/**
 * Fetch and register the signed-in app's namespaces. Idempotent, and safe to
 * call from several routes at once — they all await the same promise.
 */
export function ensureAppTranslations() {
  if (!appTranslationsPromise) {
    appTranslationsPromise = import('./appTranslations')
      .then(({ default: bundles }) => {
        for (const lng of SUPPORTED_LANGUAGES) {
          for (const ns of LAZY_NAMESPACES) {
            i18n.addResourceBundle(lng, ns, bundles[lng][ns], true, true)
          }
        }
      })
      .catch((err) => {
        // Let a later navigation retry rather than leaving the app permanently
        // stuck on raw keys because one chunk request failed.
        appTranslationsPromise = null
        throw err
      })
  }
  return appTranslationsPromise
}

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES,
    load: 'languageOnly', // de-DE, de-AT, ... → de
    ns: NAMESPACES,
    defaultNS: 'common',
    // Namespaces arrive after init via addResourceBundle, so i18next must not
    // decide up front that a language is missing them.
    partialBundledLanguages: true,
    interpolation: { escapeValue: false }, // React already escapes
    react: { useSuspense: false }, // CRITICAL: keeps SSG pre-render synchronous
    detection: {
      // An address that names a language wins over a choice cached earlier:
      // first the landing page's own path, then "?lang=", which was the German
      // landing page's address before it had a path (vercel.json sends it on
      // to /de) and still works on every page.
      order: ['landingPath', 'querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'kaydo_lang',
      caches: ['localStorage'],
    },
  })

export default i18n

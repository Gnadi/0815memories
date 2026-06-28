// i18next setup for Kaydo.
//
// Translations are imported statically (no HTTP backend) so that:
//   1. the vite-react-ssg Node pre-render of "/" is fully synchronous — the
//      static HTML is emitted with real strings, never empty placeholders;
//   2. the PWA keeps working offline without caching extra translation files.
//
// `react: { useSuspense: false }` is required for the same SSG reason: it lets
// useTranslation() return a ready `t()` on the first synchronous render in Node.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import enCommon from '../locales/en/common.json'
import enLanding from '../locales/en/landing.json'
import enAuth from '../locales/en/auth.json'
import enHome from '../locales/en/home.json'
import enMemory from '../locales/en/memory.json'
import enJournal from '../locales/en/journal.json'
import enBlackbox from '../locales/en/blackbox.json'
import enRecipes from '../locales/en/recipes.json'
import enScrapbook from '../locales/en/scrapbook.json'
import enTimeline from '../locales/en/timeline.json'
import enSettings from '../locales/en/settings.json'
import enEmotions from '../locales/en/emotions.json'
import enLegal from '../locales/en/legal.json'

import deCommon from '../locales/de/common.json'
import deLanding from '../locales/de/landing.json'
import deAuth from '../locales/de/auth.json'
import deHome from '../locales/de/home.json'
import deMemory from '../locales/de/memory.json'
import deJournal from '../locales/de/journal.json'
import deBlackbox from '../locales/de/blackbox.json'
import deRecipes from '../locales/de/recipes.json'
import deScrapbook from '../locales/de/scrapbook.json'
import deTimeline from '../locales/de/timeline.json'
import deSettings from '../locales/de/settings.json'
import deEmotions from '../locales/de/emotions.json'
import deLegal from '../locales/de/legal.json'

export const resources = {
  en: {
    common: enCommon,
    landing: enLanding,
    auth: enAuth,
    home: enHome,
    memory: enMemory,
    journal: enJournal,
    blackbox: enBlackbox,
    recipes: enRecipes,
    scrapbook: enScrapbook,
    timeline: enTimeline,
    settings: enSettings,
    emotions: enEmotions,
    legal: enLegal,
  },
  de: {
    common: deCommon,
    landing: deLanding,
    auth: deAuth,
    home: deHome,
    memory: deMemory,
    journal: deJournal,
    blackbox: deBlackbox,
    recipes: deRecipes,
    scrapbook: deScrapbook,
    timeline: deTimeline,
    settings: deSettings,
    emotions: deEmotions,
    legal: deLegal,
  },
}

export const NAMESPACES = Object.keys(resources.en)
export const SUPPORTED_LANGUAGES = ['en', 'de']

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES,
    load: 'languageOnly', // de-DE, de-AT, ... → de
    ns: NAMESPACES,
    defaultNS: 'common',
    interpolation: { escapeValue: false }, // React already escapes
    react: { useSuspense: false }, // CRITICAL: keeps SSG pre-render synchronous
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'kaydo_lang',
      caches: ['localStorage'],
    },
  })

export default i18n

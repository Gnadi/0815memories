// Translations for the signed-in app, split out of the startup bundle.
//
// Everything here is statically imported so Rollup emits it as one chunk that
// i18n/index.js pulls in via ensureAppTranslations(). Visitors who only ever
// see the landing page or the login form never download it — that was 127 KB
// of the 162 KB of raw locale JSON sitting on the critical path.
//
// Both languages are included: they arrive together so the language switcher
// keeps working instantly, without a second round of loading.

import enHome from '../locales/en/home.json'
import enMemory from '../locales/en/memory.json'
import enJournal from '../locales/en/journal.json'
import enBlackbox from '../locales/en/blackbox.json'
import enRecipes from '../locales/en/recipes.json'
import enScrapbook from '../locales/en/scrapbook.json'
import enCollage from '../locales/en/collage.json'
import enTimeline from '../locales/en/timeline.json'
import enOurYear from '../locales/en/ourYear.json'
import enSettings from '../locales/en/settings.json'
import enEmotions from '../locales/en/emotions.json'
import enLegal from '../locales/en/legal.json'

import deHome from '../locales/de/home.json'
import deMemory from '../locales/de/memory.json'
import deJournal from '../locales/de/journal.json'
import deBlackbox from '../locales/de/blackbox.json'
import deRecipes from '../locales/de/recipes.json'
import deScrapbook from '../locales/de/scrapbook.json'
import deCollage from '../locales/de/collage.json'
import deTimeline from '../locales/de/timeline.json'
import deOurYear from '../locales/de/ourYear.json'
import deSettings from '../locales/de/settings.json'
import deEmotions from '../locales/de/emotions.json'
import deLegal from '../locales/de/legal.json'

export default {
  en: {
    home: enHome,
    memory: enMemory,
    journal: enJournal,
    blackbox: enBlackbox,
    recipes: enRecipes,
    scrapbook: enScrapbook,
    collage: enCollage,
    timeline: enTimeline,
    ourYear: enOurYear,
    settings: enSettings,
    emotions: enEmotions,
    legal: enLegal,
  },
  de: {
    home: deHome,
    memory: deMemory,
    journal: deJournal,
    blackbox: deBlackbox,
    recipes: deRecipes,
    scrapbook: deScrapbook,
    collage: deCollage,
    timeline: deTimeline,
    ourYear: deOurYear,
    settings: deSettings,
    emotions: deEmotions,
    legal: deLegal,
  },
}

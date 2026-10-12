/**
 * The app screenshots on the landing page, one list for the page, the script
 * that takes them (scripts/capture-screenshots.mjs) and the test that checks
 * every one exists in every language at the size the page declares.
 *
 * `width` and `height` are the size of the file (`height` per language where
 * the languages differ), given to the <img> so the page does not jump while
 * it loads. They follow from where the script takes the picture: `viewport`
 * is the window it is taken in, `out` the width it is scaled to, and `path`
 * the page of the demo family it shows. Best-of and print dialog are taken
 * by clicking through instead (`path: null`).
 *
 * This module is imported by Node as well, so it stays plain JavaScript with
 * no imports of its own.
 */
export const SCREENSHOTS = {
  homeDesktop: { name: 'home-desktop', path: '/home', viewport: [1280, 800], out: 1200, width: 1200, height: 750 },
  homeMobile: { name: 'home-mobile', path: '/home', viewport: [390, 844], out: 440, width: 440, height: 952 },
  blackbox: { name: 'blackbox-desktop', path: '/blackbox', viewport: [1280, 800], out: 1200, width: 1200, height: 750 },
  journal: { name: 'journal-desktop', path: '/journal/demo-emma', viewport: [1280, 800], out: 1200, width: 1200, height: 750 },
  // Taller than the other desktop shots: it fills the card beside the
  // best-of's phone (BrowserFrame's `fill`), which can be a tall space.
  recipeTree: { name: 'recipe-tree-desktop', path: '/recipes/demo-recipe-1', viewport: [1280, 1600], out: 1200, width: 1200, height: 1500 },
  bestOf: { name: 'best-of-mobile', path: null, viewport: [390, 844], out: 440, width: 440, height: 952 },
  scrapbook: { name: 'scrapbook-desktop', path: '/scrapbook/demo-scrapbook', viewport: [1280, 800], out: 1200, width: 1200, height: 750 },
  // A dialog is as tall as its text, and the German text is longer.
  printDialog: { name: 'print-dialog', path: null, viewport: [1280, 800], out: 640, width: 640, height: { en: 598, de: 623 } },
  // Highlights and collages sit side by side, so they stay close in aspect.
  highlights: { name: 'highlights-desktop', path: '/highlights', viewport: [1280, 1000], out: 1200, width: 1200, height: 938 },
  collages: { name: 'collages-desktop', path: '/collages', viewport: [1280, 1000], out: 1200, width: 1200, height: 938 },
  // Phone, not desktop: this is a ritual couples do on the sofa. Taller than
  // the other phone shots so the frame reaches past the header to a chapter.
  ourYearMobile: { name: 'our-year-mobile', path: '/our-year', viewport: [390, 1000], out: 440, width: 440, height: 1128 },
}

// English pictures sit in public/screenshots/, every other language in a
// folder of its own beside them.
export const SCREENSHOT_LANGUAGES = ['en', 'de']

export function screenshotPath(shot, lang) {
  return lang === 'en' || !SCREENSHOT_LANGUAGES.includes(lang)
    ? `/screenshots/${shot.name}.webp`
    : `/screenshots/${lang}/${shot.name}.webp`
}

export function screenshotSize(shot, lang) {
  const height = typeof shot.height === 'number' ? shot.height : (shot.height[lang] ?? shot.height.en)
  return { width: shot.width, height }
}

/**
 * Which build files the service worker precaches: the app shell, not the app.
 *
 * The default is every .js/.css/.html file in the build — the scrapbook
 * editor, the rich-text editor and the PDF libraries included — and the
 * service worker is registered for every visitor. So each first visit to the
 * marketing page downloaded the whole app in the background, about 3 MB, for
 * people who may never sign in.
 *
 * The shell is the app's page, the CSS, and the JavaScript every page load runs
 * before a page is chosen — exactly what the first visit fetches anyway, so
 * installing the worker costs next to nothing extra. Route chunks are cached by sw.js the
 * first time a page needs them.
 *
 * Read from Vite's own manifest, so the shell follows the import graph rather
 * than file names. If that manifest cannot be read, everything is precached,
 * as before: slower, never broken.
 */
import { readFileSync } from 'node:fs'

// The entry imports these lazily, yet every page load needs them:
// vite-react-ssg hydrates through react-dom/client, and the PWA plugin
// registers the worker through its virtual module. The entry's other lazy
// imports are pages and features, which is what should stay out.
const STARTUP_IMPORTS = [/react-dom\/client/, /virtual:pwa-register/]

/** Every file the entry chunks load before anything is imported lazily. */
export function shellFiles(viteManifest) {
  const files = new Set()
  const visit = (key) => {
    const chunk = viteManifest[key]
    if (!chunk || files.has(chunk.file)) return
    files.add(chunk.file)
    for (const imported of chunk.imports ?? []) visit(imported)
  }
  for (const [key, chunk] of Object.entries(viteManifest)) {
    if (!chunk.isEntry) continue
    visit(key)
    for (const lazy of chunk.dynamicImports ?? []) {
      if (STARTUP_IMPORTS.some((pattern) => pattern.test(lazy))) visit(lazy)
    }
  }
  return files
}

// Of the pre-rendered pages, only "/", which the installed app starts from.
// The landing pages in each language and the legal pages each carry the whole
// stylesheet inline (scripts/inlineCss.mjs), 130–220 KB apiece, so precaching
// all of them added about 460 KB to a first visit and again after every
// deploy, for pages a visitor reads online once.
const SHELL_PAGES = new Set(['index.html'])

/** Keep the app's page, the styles and icons, and the scripts the shell needs. */
export function filterToShell(entries, viteManifest) {
  const shell = shellFiles(viteManifest)
  return entries.filter((entry) => {
    if (entry.url.endsWith('.js')) return shell.has(entry.url)
    if (entry.url.endsWith('.html')) return SHELL_PAGES.has(entry.url)
    return true
  })
}

/** A workbox `manifestTransforms` entry reading Vite's manifest from `path`. */
export function shellPrecache(path) {
  return async (entries) => {
    let viteManifest
    try {
      viteManifest = JSON.parse(readFileSync(path, 'utf8'))
    } catch {
      return { manifest: entries, warnings: [`${path} not found; precaching every file`] }
    }
    return { manifest: filterToShell(entries, viteManifest), warnings: [] }
  }
}

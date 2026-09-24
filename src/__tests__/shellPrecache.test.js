/**
 * What the service worker precaches — scripts/shellPrecache.mjs.
 *
 * It used to be every file in the build, about 3 MB, downloaded in the
 * background by every first-time visitor, including the scrapbook editor and
 * the PDF libraries. Now it is the shell: what every page load runs before a
 * page is chosen.
 */
import { describe, it, expect } from 'vitest'
import { shellFiles, filterToShell, shellPrecache } from '../../scripts/shellPrecache.mjs'

// The shape of dist/.vite/manifest.json, cut down.
const VITE_MANIFEST = {
  'index.html': {
    file: 'assets/app-1.js',
    isEntry: true,
    imports: ['_react.js', '_i18n.js'],
    dynamicImports: [
      'node_modules/react-dom/client.js',
      '../@vite-plugin-pwa/virtual:pwa-register',
      'node_modules/firebase/messaging/dist/esm/index.esm.js',
      'src/pages/HomePage.jsx',
      'src/pages/ScrapbookEditorPage.jsx',
    ],
  },
  '_react.js': { file: 'assets/react-1.js' },
  '_i18n.js': { file: 'assets/i18n-1.js', imports: ['_react.js'] },
  'node_modules/react-dom/client.js': { file: 'assets/client-1.js', isDynamicEntry: true, imports: ['_react.js'] },
  '../@vite-plugin-pwa/virtual:pwa-register': { file: 'assets/pwa-register-1.js', isDynamicEntry: true, imports: ['_workbox-window.js'] },
  '_workbox-window.js': { file: 'assets/workbox-window-1.js' },
  'node_modules/firebase/messaging/dist/esm/index.esm.js': { file: 'assets/messaging-1.js', isDynamicEntry: true },
  'src/pages/HomePage.jsx': { file: 'assets/HomePage-1.js', isDynamicEntry: true, imports: ['_react.js', '_feed.js'] },
  '_feed.js': { file: 'assets/feed-1.js' },
  'src/pages/ScrapbookEditorPage.jsx': { file: 'assets/ScrapbookEditorPage-1.js', isDynamicEntry: true, dynamicImports: ['_html2canvas.js'] },
  '_html2canvas.js': { file: 'assets/html2canvas-1.js', isDynamicEntry: true },
}

const entries = (...urls) => urls.map((url) => ({ url, revision: null, size: 1 }))

describe('shell precache', () => {
  it('follows the entry’s static imports, plus the two lazy ones every page load needs', () => {
    expect([...shellFiles(VITE_MANIFEST)].sort()).toEqual([
      'assets/app-1.js', 'assets/client-1.js', 'assets/i18n-1.js',
      'assets/pwa-register-1.js', 'assets/react-1.js', 'assets/workbox-window-1.js',
    ])
  })

  it('leaves out lazy features and pages, messaging included', () => {
    const shell = shellFiles(VITE_MANIFEST)
    for (const file of ['assets/messaging-1.js', 'assets/HomePage-1.js', 'assets/ScrapbookEditorPage-1.js', 'assets/html2canvas-1.js']) {
      expect(shell.has(file), file).toBe(false)
    }
  })

  it('keeps the HTML, CSS and icons, and drops every route chunk', () => {
    const kept = filterToShell(
      entries(
        'index.html', 'assets/app-1.css', 'favicon.svg', 'manifest.webmanifest',
        'assets/app-1.js', 'assets/react-1.js', 'assets/client-1.js', 'assets/messaging-1.js',
        'assets/HomePage-1.js', 'assets/feed-1.js', 'assets/ScrapbookEditorPage-1.js', 'assets/html2canvas-1.js',
      ),
      VITE_MANIFEST,
    ).map((e) => e.url)
    expect(kept).toEqual([
      'index.html', 'assets/app-1.css', 'favicon.svg', 'manifest.webmanifest',
      'assets/app-1.js', 'assets/react-1.js', 'assets/client-1.js',
    ])
  })

  it('precaches everything, as before, when the Vite manifest is missing', async () => {
    const all = entries('index.html', 'assets/app-1.js', 'assets/HomePage-1.js')
    const { manifest, warnings } = await shellPrecache('/nonexistent/manifest.json')(all)
    expect(manifest).toEqual(all)
    expect(warnings).toHaveLength(1)
  })
})

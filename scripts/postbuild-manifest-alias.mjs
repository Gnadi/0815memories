// Copy the hash-named vite-react-ssg loader manifest to a stable filename.
//
// Clients whose open tab (or stale service worker) predates the current deploy
// still request `static-loader-data-manifest-<oldhash>.json`. That file is
// gone after the deploy, and Vercel's SPA fallback used to answer with
// index.html — which the client then crashed on with
// "SyntaxError: Unexpected token '<' ... is not valid JSON".
// A vercel.json rewrite sends every hashed manifest URL to this stable copy,
// so stale clients get valid, current JSON instead of HTML. Looking up their
// (old) route paths in the current manifest either finds the current data file
// or yields undefined — both of which vite-react-ssg handles gracefully.
import { copyFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const manifest = readdirSync(dist).find(
  (f) => /^static-loader-data-manifest-.+\.json$/.test(f)
)

if (!manifest) {
  console.warn('[manifest-alias] no static-loader-data-manifest-*.json in dist — skipping')
  process.exit(0)
}

copyFileSync(join(dist, manifest), join(dist, 'static-loader-data-manifest.json'))
console.log(`[manifest-alias] ${manifest} -> static-loader-data-manifest.json`)

/**
 * Runs after vite-react-ssg has pre-rendered the public pages (npm run build):
 * writes dist/sitemap.xml and fails the build if a page an index should show
 * is missing its title, description, canonical, H1 or language alternates, or
 * carries JSON-LD that does not parse.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { INDEXABLE_PATHS } from '../src/seoRoutes.js'
import { buildSitemap } from './sitemap.mjs'
import { checkPage } from './seoCheck.mjs'

const dist = new URL('../dist/', import.meta.url)
const htmlFile = (path) => new URL(path === '/' ? 'index.html' : `.${path}.html`, dist)

writeFileSync(fileURLToPath(new URL('sitemap.xml', dist)), buildSitemap())

let failed = false
for (const path of INDEXABLE_PATHS) {
  const file = htmlFile(path)
  let html
  try {
    html = readFileSync(file, 'utf8')
  } catch {
    console.error(`SEO check: ${path} was not pre-rendered (${fileURLToPath(file)} is missing)`)
    failed = true
    continue
  }
  for (const error of checkPage(html, path)) {
    console.error(`SEO check: ${path}: ${error}`)
    failed = true
  }
}

if (failed) process.exit(1)
console.log(`SEO check: ${INDEXABLE_PATHS.length} pages pass; sitemap.xml written`)

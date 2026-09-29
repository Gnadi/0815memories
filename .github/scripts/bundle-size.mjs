// Reports the size of the production build in the job summary, and on a pull
// request how it changed against the last build of main.
//
// Two numbers matter. The shell — the HTML's entry script, what it imports
// statically, and the stylesheet — is what every visit downloads before the
// first paint, the landing page's included; scripts/shellPrecache.mjs picks
// the same files for the service worker. The total is everything, route
// chunks included, which only matters once someone signs in.
//
//   node .github/scripts/bundle-size.mjs <dist> <out.json> [<base.json>]
//
// Writes this build's sizes to <out.json>; with <base.json> (the file a build
// of main wrote) it adds the difference. It never fails the job: a bigger
// bundle is sometimes the price of a feature. Shell growth beyond
// SHELL_WARN_KB (gzip, default 10) is raised as a warning on the run.
import { readFileSync, readdirSync, writeFileSync, appendFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { shellFiles } from '../../scripts/shellPrecache.mjs'

const [dist = 'dist', outPath = 'bundle-sizes.json', basePath] = process.argv.slice(2)
const shellWarnKb = Number(process.env.SHELL_WARN_KB || 10)

const manifest = JSON.parse(readFileSync(join(dist, '.vite/manifest.json'), 'utf8'))
const shell = shellFiles(manifest)
for (const chunk of Object.values(manifest)) {
  if (chunk.isEntry) for (const css of chunk.css ?? []) shell.add(css)
}

// Chunk names without the content hash, so the same chunk can be matched
// across builds. Chunks sharing a name are added up.
const nameOf = (file) => file.replace(/^assets\//, '').replace(/-[\w-]{8}(\.\w+)$/, '$1')

const sizes = { shell: { raw: 0, gzip: 0 }, total: { raw: 0, gzip: 0 }, chunks: {} }
for (const file of readdirSync(join(dist, 'assets'))) {
  if (!/\.(js|css)$/.test(file)) continue
  const content = readFileSync(join(dist, 'assets', file))
  const raw = content.length
  const gzip = gzipSync(content, { level: 9 }).length
  const path = `assets/${file}`
  const name = nameOf(path)
  sizes.total.raw += raw
  sizes.total.gzip += gzip
  if (shell.has(path)) {
    sizes.shell.raw += raw
    sizes.shell.gzip += gzip
  }
  sizes.chunks[name] = (sizes.chunks[name] ?? 0) + gzip
}
writeFileSync(outPath, JSON.stringify(sizes, null, 2) + '\n')

const base = basePath && existsSync(basePath) ? JSON.parse(readFileSync(basePath, 'utf8')) : null

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`
const delta = (now, before) => {
  if (before == null) return ''
  const diff = now - before
  if (Math.abs(diff) < 100) return '±0'
  return `${diff > 0 ? '+' : '−'}${kb(Math.abs(diff))}`
}

const lines = ['## Bundle size', '']
lines.push(
  base
    ? '| | gzip | raw | vs. main (gzip) |\n| --- | ---: | ---: | ---: |'
    : '| | gzip | raw |\n| --- | ---: | ---: |',
)
for (const [label, key] of [['Shell (every visit)', 'shell'], ['Everything', 'total']]) {
  const row = `| ${label} | ${kb(sizes[key].gzip)} | ${kb(sizes[key].raw)} |`
  lines.push(base ? `${row} ${delta(sizes[key].gzip, base[key].gzip)} |` : row)
}

if (base) {
  const names = new Set([...Object.keys(sizes.chunks), ...Object.keys(base.chunks)])
  const changed = [...names]
    .map((name) => ({ name, now: sizes.chunks[name] ?? 0, before: base.chunks[name] ?? 0 }))
    .filter(({ now, before }) => Math.abs(now - before) >= 1024)
    .sort((a, b) => Math.abs(b.now - b.before) - Math.abs(a.now - a.before))
  lines.push('')
  if (changed.length === 0) {
    lines.push('No chunk changed by 1 KB or more (gzip).')
  } else {
    lines.push('Chunks that changed by 1 KB or more (gzip):', '', '| Chunk | main | now | |', '| --- | ---: | ---: | ---: |')
    for (const { name, now, before } of changed.slice(0, 20)) {
      const label = !before ? 'new' : !now ? 'removed' : delta(now, before)
      lines.push(`| \`${name}\` | ${before ? kb(before) : '—'} | ${now ? kb(now) : '—'} | ${label} |`)
    }
  }

  const growth = sizes.shell.gzip - base.shell.gzip
  if (growth > shellWarnKb * 1024) {
    console.log(
      `::warning::The shell every visitor downloads grew by ${kb(growth)} (gzip) to ${kb(sizes.shell.gzip)}. ` +
        'See the job summary for the chunks behind it.',
    )
  }
} else {
  lines.push('', '_No build of main to compare with yet._')
}

const summary = lines.join('\n') + '\n'
console.log(summary)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)

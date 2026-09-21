// Fails the build while `npm audit` reports an advisory at or above
// AUDIT_LEVEL (default: high) for any of the lockfiles passed as arguments
// (a directory each, `.` when none are given).
//
// npm's own `--audit-level` only decides the exit code: it prints every
// finding and never says which one actually blocks, so a red job means
// reading 60 entries to find the 4 that matter. This wrapper reports exactly
// what has to be fixed, whether it reaches users (a second audit with
// `--omit=dev`) and whether a fix exists, both in the log and in the job
// summary.
import { spawnSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'

const LEVELS = ['info', 'low', 'moderate', 'high', 'critical']

const level = (process.env.AUDIT_LEVEL || 'high').toLowerCase()
if (!LEVELS.includes(level)) {
  console.error(`::error::AUDIT_LEVEL must be one of ${LEVELS.join(', ')} — got "${level}".`)
  process.exit(1)
}

const threshold = LEVELS.indexOf(level)
const dirs = process.argv.slice(2)
if (dirs.length === 0) dirs.push('.')

// `npm audit` needs no node_modules: it resolves the tree from the lockfile
// and asks the registry which of it is affected.
function audit(dir, { omitDev = false } = {}) {
  const args = ['audit', '--json', ...(omitDev ? ['--omit=dev'] : [])]
  const run = spawnSync('npm', args, { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

  if (run.error) {
    console.error(`::error::Could not run npm audit in ${dir}: ${run.error.message}`)
    process.exit(1)
  }

  // A found vulnerability also exits non-zero, so the exit code says nothing
  // on its own — the report does. Output that is not a report means the audit
  // itself failed (no lockfile, registry unreachable), which must never pass
  // as "nothing found".
  let report
  try {
    report = JSON.parse(run.stdout)
  } catch {
    console.error(`::error::npm audit returned no report for ${dir} — it could not run.`)
    console.error(run.stderr.trim() || run.stdout.trim())
    process.exit(1)
  }

  if (report.error) {
    console.error(`::error::npm audit failed in ${dir}: ${report.error.summary || report.error.code}`)
    process.exit(1)
  }

  return report
}

function describeFix(fixAvailable) {
  if (fixAvailable === true) return '`npm audit fix`'
  if (!fixAvailable) return 'no fix published'
  const major = fixAvailable.isSemVerMajor ? ', breaking' : ''
  return `${fixAvailable.name}@${fixAvailable.version}${major}`
}

// The advisories behind a finding: `via` holds either advisory objects (this
// package is the vulnerable one) or the names of the packages it inherits the
// problem from. A package with two dozen advisories would bury the table, so
// only the first few are listed — the rest are on the same npm page.
const LISTED_ADVISORIES = 3

function describeAdvisories(vulnerability) {
  const seen = new Map()
  for (const entry of vulnerability.via || []) {
    if (typeof entry === 'object') seen.set(entry.url || entry.title, entry)
  }

  if (seen.size === 0) {
    const from = (vulnerability.via || []).join(', ')
    return from ? `via ${from}` : ''
  }

  const advisories = [...seen.values()]
  const listed = advisories
    .slice(0, LISTED_ADVISORIES)
    .map((a) => (a.url ? `[${a.title}](${a.url})` : a.title))
  const rest = advisories.length - listed.length
  if (rest > 0) listed.push(`… and ${rest} more`)
  return listed.join('<br>')
}

const counts = Object.fromEntries(LEVELS.map((l) => [l, 0]))
const blocking = []

for (const dir of dirs) {
  const report = audit(dir)
  // Everything the audit finds for the runtime dependencies alone — the part
  // that is shipped rather than only installed on a developer machine.
  const runtime = new Set(Object.keys(audit(dir, { omitDev: true }).vulnerabilities || {}))

  for (const [severity, count] of Object.entries(report.metadata?.vulnerabilities || {})) {
    if (severity in counts) counts[severity] += count
  }

  for (const [name, vulnerability] of Object.entries(report.vulnerabilities || {})) {
    if (LEVELS.indexOf(vulnerability.severity) < threshold) continue
    blocking.push({
      dir,
      name,
      severity: vulnerability.severity,
      scope: runtime.has(name) ? 'runtime' : 'dev only',
      depth: vulnerability.isDirect ? 'direct' : 'transitive',
      fix: describeFix(vulnerability.fixAvailable),
      advisories: describeAdvisories(vulnerability),
    })
  }
}

blocking.sort((a, b) => LEVELS.indexOf(b.severity) - LEVELS.indexOf(a.severity) || a.name.localeCompare(b.name))

const total = LEVELS.reduce((sum, l) => sum + counts[l], 0)
const found = LEVELS.filter((l) => counts[l] > 0).map((l) => `${counts[l]} ${l}`).join(', ') || 'none'

const summary = []
summary.push(`## npm audit (failing at ${level} and above)`, '')
summary.push(`Audited: ${dirs.join(', ')} — ${total} advisories in total (${found}).`, '')

if (blocking.length === 0) {
  summary.push(`No advisory at ${level} or above is open.`)
} else {
  summary.push('| Package | Severity | Scope | Dependency | Fix | Advisory |')
  summary.push('| --- | --- | --- | --- | --- | --- |')
  for (const row of blocking) {
    const where = dirs.length > 1 && row.dir !== '.' ? `${row.dir}: ${row.name}` : row.name
    summary.push(`| \`${where}\` | ${row.severity} | ${row.scope} | ${row.depth} | ${row.fix} | ${row.advisories} |`)
  }
}

const text = summary.join('\n')
console.log(text)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n\n`)

if (blocking.length > 0) {
  const packages = blocking.map((row) => row.name).join(', ')
  console.error(`::error::${blocking.length} open ${level}-or-above advisories: ${packages}`)
  process.exit(1)
}

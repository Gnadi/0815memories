// Checks the Developer Certificate of Origin sign-off on every commit of a
// pull request (see CONTRIBUTING.md):
//
//   node .github/scripts/dco.mjs <base-sha> <head-sha>
//
// A sign-off is a person certifying that they may contribute the change, so:
//
// - A commit by a person needs a `Signed-off-by:` with the author's own email.
// - A commit by a coding agent (Claude and the like) needs a sign-off by the
//   person who directed it. The agent's own sign-off never counts: an agent
//   cannot certify anything.
// - Commits by GitHub Apps (Dependabot) are exempt; they change nothing but
//   dependency versions.
// - Merge commits are skipped: they add no code of their own.
import { execFileSync } from 'node:child_process'
import { appendFileSync } from 'node:fs'

const [base, head] = process.argv.slice(2)
if (!base || !head) {
  console.error('usage: node .github/scripts/dco.mjs <base-sha> <head-sha>')
  process.exit(1)
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

// Authors that are software, not people. Their sign-off certifies nothing.
const AGENT_EMAILS = new Set(['noreply@anthropic.com'])
const isBot = (email) => /\[bot\]@users\.noreply\.github\.com$/i.test(email)
const isAgent = (email) => AGENT_EMAILS.has(email.toLowerCase())

const commits = git('rev-list', '--no-merges', '--reverse', `${base}..${head}`)
  .split('\n')
  .filter(Boolean)

const failures = []
for (const sha of commits) {
  const [name, email, subject] = git('log', '-1', '--format=%an%x00%ae%x00%s', sha).split('\0')
  if (isBot(email)) continue

  const signOffs = git('log', '-1', '--format=%(trailers:key=Signed-off-by,valueonly)', sha)
    .split('\n')
    .map((line) => line.match(/<([^>]+)>\s*$/)?.[1]?.toLowerCase())
    .filter(Boolean)
  const byPeople = signOffs.filter((signer) => !isAgent(signer) && !isBot(signer))

  const ok = isAgent(email)
    ? byPeople.length > 0
    : byPeople.includes(email.toLowerCase())
  if (!ok) {
    const needed = isAgent(email)
      ? `a sign-off by the person who directed ${name}`
      : `Signed-off-by: ${name} <${email}>`
    failures.push({ sha: sha.slice(0, 7), subject, needed })
  }
}

const lines = ['## DCO sign-off', '']
if (failures.length === 0) {
  lines.push(`All ${commits.length} commit(s) are signed off.`)
} else {
  lines.push(
    `${failures.length} of ${commits.length} commit(s) lack a valid sign-off:`,
    '',
    '| Commit | Subject | Needs |',
    '| --- | --- | --- |',
    ...failures.map((f) => `| \`${f.sha}\` | ${f.subject.replace(/\|/g, '\\|')} | ${f.needed} |`),
    '',
    'To fix: `git rebase --signoff origin/main`, then `git push --force-with-lease`.',
    'New commits: `git commit -s`. See "Sign your commits" in CONTRIBUTING.md.',
  )
  for (const f of failures) console.log(`::error::Commit ${f.sha} "${f.subject}" needs ${f.needed}.`)
}

const summary = lines.join('\n') + '\n'
console.log(summary)
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
process.exit(failures.length ? 1 : 0)

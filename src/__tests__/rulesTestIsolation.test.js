/**
 * Every rules test file needs its own emulator project.
 *
 * The rules suites all call `testEnv.clearFirestore()` in `beforeEach`, and
 * that wipes an entire *project*. Vitest runs test files in parallel workers
 * against the one emulator, so two files sharing a projectId delete each
 * other's seed data halfway through a test.
 *
 * It fails the way concurrency bugs always do: intermittently, in whichever
 * file lost the race, and only ever on the assertions that expect access to be
 * *granted* — the denials keep passing, because a document that was just
 * deleted is denied for the wrong reason. blackboxRules and ourYearRules both
 * used `demo-kaydo-rules` and did exactly this; it read as flakiness for a
 * while before anyone looked.
 *
 * This guard runs in the ordinary `npm test` — no emulator needed, it just
 * reads the files — so a copied projectId is caught at the point someone
 * copies it.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// From the project root, not `import.meta.url`: Vite rewrites that to a
// project-relative path, which `readdirSync` then resolves against `/`.
// `globalThis.process` rather than the bare global, matching the other rules
// suites: eslint gives files under src/ browser globals only.
const TEST_DIR = join(globalThis.process.cwd(), 'src', '__tests__')

function rulesTestFiles() {
  return readdirSync(TEST_DIR).filter((name) => /Rules\.test\.js$/.test(name))
}

const projectIdOf = (source) => source.match(/projectId:\s*['"]([^'"]+)['"]/)?.[1] ?? null

describe('rules test isolation', () => {
  it('finds the rules suites', () => {
    // A rename that silences this whole file would otherwise go unnoticed.
    expect(rulesTestFiles().length).toBeGreaterThanOrEqual(5)
  })

  it('gives every rules suite its own emulator project', () => {
    const byProject = new Map()

    for (const file of rulesTestFiles()) {
      const projectId = projectIdOf(readFileSync(join(TEST_DIR, file), 'utf8'))
      expect(projectId, `${file} passes no projectId to initializeTestEnvironment`).toBeTruthy()
      byProject.set(projectId, [...(byProject.get(projectId) ?? []), file])
    }

    const shared = [...byProject.entries()].filter(([, files]) => files.length > 1)
    expect(
      shared.map(([projectId, files]) => `${projectId}: ${files.join(', ')}`),
      'these files share an emulator project and will clear each other mid-run',
    ).toEqual([])
  })
})

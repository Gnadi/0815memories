/**
 * The whole app on this machine, with no Firebase project and no .env.local:
 *
 *   npm run dev:local
 *
 * Starts the Auth, Firestore and Functions emulators (with the emulator UI on
 * http://127.0.0.1:4000), seeds the demo family (scripts/seed-emulator.mjs),
 * then runs the Vite dev server against them. Ctrl+C stops everything; the
 * emulator data is thrown away and seeded afresh on the next start.
 *
 * Needs Java 11+ for the Firestore emulator. Sign in at /login?admin=1 as
 * demo@kaydo.app / demo123456, or as a viewer at /family/the-bennetts.
 */
import { spawnSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// The Functions emulator loads functions/ with its own dependencies.
if (!existsSync(join(root, 'functions', 'node_modules'))) {
  console.log('Installing the Cloud Functions dependencies (functions/) …')
  const install = spawnSync('npm', ['ci'], { cwd: join(root, 'functions'), stdio: 'inherit' })
  if (install.status !== 0) process.exit(install.status ?? 1)
}

if (spawnSync('java', ['-version'], { stdio: 'ignore' }).error) {
  console.error('The Firestore emulator needs Java 11 or newer, and `java` is not on the PATH.')
  process.exit(1)
}

// Placeholders: in emulator mode only the project id has to be real, and it
// must match .firebaserc. Variables set here take precedence over .env.local,
// so a real project's keys in there cannot slip into a local session.
const env = {
  ...process.env,
  VITE_USE_EMULATOR: 'true',
  VITE_FIREBASE_API_KEY: 'demo-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo-kaydo.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'demo-kaydo',
  VITE_FIREBASE_APP_ID: 'demo-app-id',
}

const child = spawn(
  'npx',
  [
    'firebase', 'emulators:exec',
    '--only', 'auth,firestore,functions',
    '--project', 'demo-kaydo',
    '--ui',
    'node scripts/seed-emulator.mjs && npx vite',
  ],
  { cwd: root, env, stdio: 'inherit' },
)
child.on('exit', (code) => process.exit(code ?? 0))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal))

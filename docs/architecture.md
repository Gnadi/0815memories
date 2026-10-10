# Architecture

A map for finding your way around Kaydo before changing it. The README says
what Kaydo does; this page says where each part lives and how the parts
depend on each other. The detailed reasoning sits in the code comments, which
are written to be read. The other documents in `docs/` are design notes for
single features.

## The pieces

```
Browser (React SPA + service worker)
 │  encrypts family content with the family's AES key before it leaves
 │
 ├── Firebase Auth ─────── admins: email/password
 │                         viewers: custom token from viewerLogin
 ├── Firestore ─────────── all data; firestore.rules decide every read and write
 ├── Cloud Functions ───── viewer login, admin claims, public mirror, push
 │   (functions/, europe-west3)
 ├── Vercel function ───── api/cloudinary-sign: upload signatures, admins only
 └── Cloudinary ────────── media, stored as encrypted `raw` files
```

There is no server of our own. The browser talks to Firestore directly, so
**`firestore.rules` is the backend's authorization layer**. What the UI hides
is a convenience; what the rules deny is the actual protection.

## Who is asking

There are two roles, and both come from the Firebase ID token, never from
anything the client can edit:

- **Admins** sign in with email and password. The `syncAdminClaims` trigger
  puts `{ familyId, role: 'admin' }` on their token whenever the family's
  `adminUids` change. The rules also accept an admin listed in `adminUids`
  whose claim has not arrived yet (`isAdminByDocument` in `firestore.rules`).
- **Viewers** have no account. They enter the family's shared password. The
  `viewerLogin` callable function checks it against a bcrypt hash in
  `families/{id}/secrets/auth`, with rate limiting, and returns a custom token
  with `role: 'viewer'`. Viewers can read and never write.

On the client, `src/context/AuthContext.jsx` works out the role, the family
and the encryption key. `ProtectedRoute` in `src/App.jsx` guards routes:
`protect()` admits any member, `protectAdmin()` admins only.

A family is addressed by its slug: `<slug>.kaydo.app` in production and
`/family/<slug>` anywhere (`src/utils/familySlug.js`). Before sign-in, the
login page can read only `familyPublic/{familyId}`: the family name and the
login-page design, mirrored there by `mirrorFamilyPublic` from a fixed
allowlist. `familySlugs/{slug}` keeps slugs unique.

## Encryption

Each family has one AES-256-GCM key, generated in the browser at signup and
stored as a JWK in the family document (`encryptionKeyJwk`). Only members can
read that document, and nobody can change the key in it: the rules refuse an
update that adds, replaces or removes it (`keepsEncryptionKey()`), since that
would make everything encrypted with the old key unreadable. `src/utils/encryption.js` encrypts text fields, JSON and
blobs; `src/utils/encryptedUpload.js` encrypts files and uploads them to
Cloudinary as `raw` resources. `src/components/media/` decrypts media for
display (`useDecryptedMedia`, `EncryptedImage`, …).

Because the key lives in Firestore, Kaydo is **not** zero-knowledge; the
README's *Security & encryption* section spells out that limit.

Every family has a key: the rules refuse to create a family without one
(`hasEncryptionKey()`), and Kaydo no longer opens a family from before
encryption. When the key does not come — the family document has none, the
browser cannot import it, or the document cannot be read — `AuthContext`
reports why (`keyError`) and `ProtectedRoute` shows that instead of the app.
The encryption helpers back this up: writing without a key throws, except in
the demo, whose family is the only one without one. The emulator seed is
encrypted like any other family, pictures included.

## Data model

Every top-level collection holds documents for all families, each with a
`familyId` field. The rules check that field on every read and write, and
`familyUnchanged()` stops an update from moving a document to another
family.

| Collection | Holds | Written by |
| --- | --- | --- |
| `families/{id}` | name, slug, admins, key (set at signup, never changed), login-page design | admins |
| `families/{id}/secrets/auth` | bcrypt hash of the shared password | `setSharedPassword` function only |
| `families/{id}/admins`, `/invites` | admin metadata, co-admin invites | admins |
| `familyPublic/{id}` | the public login-page subset | `mirrorFamilyPublic` function only |
| `familySlugs/{slug}` | slug → family | functions only |
| `memories`, `moments`, `albums` | the feed | admins |
| `children`, `journals` | children (birth time and place for the birth sky, encrypted) and their journal entries and letters | admins |
| `blackbox`, `blackboxContent` | the Vault; time-locked capsules open by `request.time` | admins |
| `recipes` | recipe tree with versions and forks | admins |
| `scrapbooks`, `collages`, `highlights` | the creative tools | admins |
| `ourYearRituals`, `ourYearChapters`, `ourYearEntries`, `ourYearLetters` | *Our Year*, readable by its two partners only | the partners |
| `fcmTokens` | devices registered for push; never readable by clients | family members |
| `notificationsQueue` | retired; closed in the rules | nobody |
| `rateLimits`, `viewerDevices` | viewer-login throttling and remembered devices | functions only |
| `feedback` | app feedback, deliberately unencrypted, append-only | family members |

Composite indexes are in `firestore.indexes.json`. Both files are deployed
from CI on merge (`.github/workflows/firebase-firestore.yml`).

## Cloud Functions (`functions/`)

All functions are v2 and run in `europe-west3`, set in `setGlobalOptions` at
the top of `functions/index.js`.

| Function | Trigger | Does |
| --- | --- | --- |
| `viewerLogin` | callable | password check, rate limit, viewer token |
| `setSharedPassword` | callable, admins | stores a new password hash and revokes viewer sessions |
| `syncAdminClaims` | `families/{id}` written | admin role claims |
| `mirrorFamilyPublic` | `families/{id}` written | `familyPublic` mirror and slug registry |
| `notifyOnMemory`, `notifyOnMoment` | document created | push to the family |
| `dailyAnniversaryCheck` | schedule, 08:00 Europe/Berlin | anniversary push |

Logic worth testing lives in its own module (`viewerLogin.js`, `slugs.js`,
`anniversary.js`, `push.js`), and `src/__tests__/` imports it directly.
The functions are deployed by hand for now (README, *Getting started*).

## The front end (`src/`)

| Path | What is there |
| --- | --- |
| `main.jsx`, `App.jsx` | entry point, routes, route guards, lazy loading |
| `pages/` | one component per route |
| `components/<feature>/` | components of one feature (`scrapbook/`, `ouryear/`, …) |
| `services/` | Firestore reads and writes per area, with their encryption (`memories.js`, …) — see below |
| `hooks/` | React state on top of the services: live lists, writers (`useMemories`, …) |
| `utils/` | encryption, uploads, rendering (canvas, PDF, video), slug handling |
| `context/AuthContext.jsx` | session, role, family, encryption key |
| `config/` | the Firebase and Cloudinary clients; emulator switch; `firestore.js`, the one door to Firestore |
| `demo/` | the demo family: flag, in-memory database, content, banner |
| `constants/` | shared constants, some mirrored in `firestore.rules` |
| `locales/{en,de}/`, `i18n/` | translations; public namespaces load eagerly, the rest lazily |
| `sw.js` | the service worker (Workbox, `injectManifest`) |
| `__tests__/` | unit tests, rules tests (`*Rules.test.js`) |

### Services

`src/services/` is where the app reads and writes Firestore, one module per
area: the collection, the queries, which fields are encrypted and how, and the
shape of what is written (`familyId`, timestamps). Hooks hold the React state
on top of it, and pages load single documents through it (`getRecipe`,
`getScrapbook`, …), so a list and a page decrypt a document the same way.
Lists subscribe through `subscribeDecrypted` (`services/decrypted.js`), which
delivers only the newest snapshot's documents: decrypting is asynchronous, and
an older snapshot must not overwrite a newer one.

Services reach Firestore through `config/firestore.js`, so the demo needs
nothing of its own here. ESLint refuses `config/firestore` imports outside
`src/services/` (`Timestamp` excepted); the files that predate the services
are listed in `eslint.config.js` and move over area by area. So far memories,
moments, recipes, scrapbooks, collages, highlights, the kids and their
journals, the Vault and Our Year have.

Build and delivery details that affect many changes:

- **Pre-rendering.** `vite-react-ssg` renders the landing page (`/`) to
  static HTML at build time. Anything on the public routes must render in
  Node, without `window`. The signed-in app is client-only and lazy-loaded.
- **The shell is kept small.** Only the startup code is precached by the
  service worker (`scripts/shellPrecache.mjs`); pages and the signed-in
  translations load on demand. CI reports the shell's size on every PR.
- **Hosting** is Vercel (`vercel.json`): the SPA rewrite, cache headers,
  security headers, and `api/` as serverless functions.

## The demo

`/demo` opens a demo family in the current tab, without an account and
without a server. It is the real app running on different data, so it is
built at the two seams everything already passes through:

- **The flag.** `src/demo/demoMode.js` keeps it in sessionStorage, so it
  belongs to one tab. Entering and leaving are hard navigations, because the
  flag is read once per page load. In a demo tab `config/firebase.js` does
  not start Firebase at all: no restored session, no listener, no push, and
  every callable reads as not configured. `utils/authStorage.js` neither reads
  nor writes the stored session, which belongs to whoever is signed in
  outside the demo.
- **Firestore.** Every Firestore call in `src/` goes through
  `src/config/firestore.js` (ESLint refuses direct `firebase/firestore`
  imports). Outside the demo it is the SDK; in a demo tab it answers from
  `src/demo/demoDatabase.js`, an in-memory implementation of the part of the
  Firestore API the app uses, including the read rules a visitor can see
  from the outside: the Vault's and Our Year's time locks.
- **The session.** `AuthContext` loads `src/demo/index.js`, which installs
  the database, filled by `src/demo/demoFamily.js` with the family in the
  interface language, and signs in its owner as an admin. The family has no
  encryption key, the only one allowed to, so the app writes its content as
  it is and shows the pictures in `public/demo-media/` as they are. Dates
  are counted from the moment the demo starts, so the family never ages.

Uploads in the demo become object URLs that live as long as the tab
(`utils/encryptedUpload.js`). What needs a server says so instead: the viewer
password, invite links, the print order, push and feedback. The demo is
lazy-loaded; only the flag and `config/firestore.js` are in the shell.

## Tests

| Kind | Where | Run with |
| --- | --- | --- |
| Unit and component | `src/__tests__/*.test.js(x)` | `npm test` |
| Security rules | `src/__tests__/*Rules.test.js`, listed in `package.json` | `npm run test:rules` |
| End to end | `e2e/*.e2e.js` | `npm run test:e2e` |

The rules and E2E tests run against the Firebase emulators. The E2E tests use
the demo family from `scripts/seed-emulator.mjs`, the same data
`npm run dev:local` starts with — except `e2e/demo.e2e.js`, which walks the
in-browser demo and needs no emulator.

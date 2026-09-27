# Kaydo

A private, encrypted family memory platform — your family's own corner of the internet. Every family claims its own address (`yourname.kaydo.app`) and gets a warm, ad-free space for photos, stories, recipes and letters across generations.

**Live demo:** [the-bennetts.kaydo.app](https://the-bennetts.kaydo.app) · **Website:** [kaydo.app](https://kaydo.app)

## Features

### Share
- **Memory feed** — rich memory cards with photos, videos, voice memos, stories and quotes
- **Daily Moments** — story circles for quick everyday snapshots
- **Smart timeline** — memories grouped by season, with "on this day" lookbacks

### Preserve
- **The Vault (Black Box)** — high-fidelity originals of your most precious documents and photos, with **time-locked capsules** that stay sealed until a date you choose
- **Letters & kids' journals** — dated entries and letters to your children, written for the future
- **Sky of birth** — from each child's journal: the stars, constellations, planets and the moon in its exact phase above their birthplace at the moment they were born, as a poster in three styles (PNG, A4 / A3 PDF) or a post in the feed. Everything is computed on the device with `astronomy-engine`; the birthplace is picked from a bundled place list rather than a geocoding service, and birth time and place are stored encrypted. Without a known time it shows the night sky of that day. Star and constellation data © Olaf Frohn ([d3-celestial](https://github.com/ofrohn/d3-celestial), BSD-3-Clause), places from [GeoNames](https://www.geonames.org/) (CC BY 4.0); regenerate them with `scripts/build-sky-data.mjs`. Licenses and attributions for this data and the bundled font are in `THIRD_PARTY_NOTICES.md`
- **Full data export** — download everything as a ZIP of plain, readable files plus structured JSON; NAS-friendly, no lock-in

### Create & evolve
- **Recipe tree** — family recipes with version history, forks and photo logs across generations
- **Digital scrapbook** — freeform drag-and-drop canvas with polaroid frames, stickers and text; export finished books as PDF
- **Collages** — pick a template from the gallery, drop family photos into its shaped slots, restyle the frame and background, then download the image or post it to the feed. Preview, thumbnail and export all come from one Canvas 2D renderer, so what you see is what you get
- **Highlight videos** — turn a year, a season or a run of memories into a short reel with a title card, Ken Burns moves and crossfades. It plays in the app anywhere; where the browser supports `MediaRecorder` it also downloads as a video file. Posting a reel to the feed is bounded by the same encrypted-upload cap as any other video (10 MB on the free Cloudinary plan) — the app says so with real numbers instead of failing the upload, and downloading works at any size
- **Login page designer** — give your family's address its own front door, from starter templates to a custom photo welcome page

### Just the two of you
- **Our Year** — a recurring review ritual for a couple, on whatever day they choose, or on no fixed day at all. It holds four things per chapter:
  - a **shared look back**: both partners answer the same five questions independently, and the answers only become visible once both have handed in
  - a **couple's quiz** whose questions are rewritten for every chapter — no points, no winner, different memories welcome
  - a **letter to their future selves** that the server refuses to hand out until the date they picked, so it cannot be read early, not even straight from the console
  - **four keepsakes**: one photo, one song, one sentence, one moment

  Closed chapters become a shared timeline of the relationship. Nothing here assumes marriage, children, or twelve-month cycles, and it is visible to those two accounts only — not even other family admins can see it

### Everyday
- **Feedback** — anyone in the family, viewer or admin, can send a note about the app itself from the sidebar or the mobile header: a rating, a category and a few words. It lands in the `feedback` collection, which the client may only append to — never read back, edit or delete
- **Two access levels** — viewers enter with one shared family password (no account needed); admins sign in via Firebase Auth. Invite co-admins with secure invite links
- **PWA** — installable on any phone or desktop, instant loads via service-worker precache, push notifications for new memories, anniversary reminders
- **Bilingual** — full English and German UI (i18next)

## Security & encryption

- Photos, videos, voice memos, journal entries, recipes, scrapbooks and Vault content are encrypted **client-side** with **AES-256-GCM** (Web Crypto API) before upload — see `src/utils/encryption.js` and `src/utils/encryptedUpload.js`
- Media is stored as raw ciphertext (Cloudinary `raw` resources); the server never receives a renderable image
- Because of that, uploads are bound by Cloudinary's **raw** file-size cap (10 MB on the free plan), not the far higher video cap. Files above the cap are rejected before upload with a message naming the size and the limit; raise `VITE_CLOUDINARY_MAX_UPLOAD_BYTES` after upgrading the plan
- Images deliberately left unencrypted: only the public login-page design assets, which must render before anyone is authenticated
- Upload signatures from `api/cloudinary-sign` are handed out only to a family admin — the function asks Firestore, with the caller's own ID token, for the families that list them as an admin, so Firestore verifies the token and the rules decide — viewers never upload, and a signature is write access to the Cloudinary account
- **Our Year** goes further than the rest of the app: instead of trusting the UI, `firestore.rules` decides who may read what. A partner's answers are unreadable until both have handed in, a sealed letter is unreadable until its open date (`request.time`), and a closed chapter can no longer be edited. Those guarantees are covered by emulator tests — `npm run test:rules`
- **Nothing is readable without an identity.** A viewer signs in against a Cloud Function that checks the shared password server-side and issues a token carrying their family; `firestore.rules` gates every collection on that token. Until recently viewers had no Firebase session at all, which forced the family document — encryption key included — to be world-readable. See `docs/plan-a-zugriffskontrolle.md`
- The login page's design is served from `familyPublic/{familyId}`, a mirror written by a Cloud Function from a fixed allowlist, so the public surface of a family cannot grow by accident
- A family's address (`<slug>.kaydo.app`) is unique on the server, not just in the signup form: the same function keeps a `familySlugs` registry and publishes a slug to `familyPublic` only for the family holding it, so a new family cannot take over an existing family's login page by copying its slug
- App feedback is the one collection written *unencrypted* on purpose: it is addressed to whoever runs Kaydo, and ciphertext would make every bug report unreadable to the person who has to act on it. The form says so on screen, `firestore.rules` pins the document to the shape in `src/constants/feedback.js`, and nothing in the app can read the collection back
- **Honest limitation:** the per-family encryption key is stored in the family's Firestore document. It is no longer public — only the family can read it — but it is still readable server-side, so Kaydo is *not* zero-knowledge. Deriving the key from the shared password is the path to that, and the price is that a forgotten password means the data is gone

## Tech stack

- **React + Vite** with **vite-react-ssg** (the landing page is pre-rendered to static HTML)
- **Tailwind CSS** — warm, cozy design system
- **Firebase** — Auth, Firestore, Cloud Functions (viewer login, admin claims, push notifications), Cloud Messaging, Cloud Scheduler. Deploying functions requires the Blaze plan; all of them run in `europe-west3`
- **Cloudinary** — media storage (signed uploads via the `api/cloudinary-sign` Vercel function)
- **Workbox** — PWA service worker
- **i18next** — EN/DE localization
- **Vitest** — test suite

## Getting started

### Run it locally — no accounts needed

```bash
npm install
npm run dev:local
```

That starts the Firebase emulators (Auth, Firestore, Functions; UI on
http://127.0.0.1:4000), seeds a demo family and opens the app on
http://localhost:5173. Needs Node 22 and Java 11+ for the Firestore emulator —
or open the repository in GitHub Codespaces / a VS Code Dev Container
(`.devcontainer/`), which brings both.

| Sign in as | Where | Credentials |
| --- | --- | --- |
| Admin | `/login?admin=1` | `demo@kaydo.app` / `demo123456` |
| Second admin (for Our Year) | `/login?admin=1` | `partner@kaydo.app` / `demo123456` |
| Viewer | `/family/the-bennetts` | `bennetts-family` |

The data is thrown away when you stop it and seeded afresh on the next start.
Media uploads go to Cloudinary and do not work in this mode; everything
else does.

### Run it against your own Firebase project

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your Firebase and Cloudinary credentials (see the comments in `.env.example` for details, including the FCM VAPID key for push notifications).

3. Set up Firebase:
   - Create a project at console.firebase.google.com
   - Enable Email/Password authentication
   - Create a Firestore database and deploy `firestore.rules`
   - Deploy the Cloud Functions with `firebase deploy --only functions` (needs the Blaze plan). Viewer login is one of them, so the app is not fully usable without this step
   - Push notifications additionally need a Web Push certificate: Firebase Console → Cloud Messaging → Web Push certificates, then `VITE_FIREBASE_VAPID_KEY`. See `docs/plan-notifications.md` for how the pieces fit together

4. Set up Cloudinary and put the API key/secret into your Vercel project (server-side env vars for `api/cloudinary-sign.js`). The function signs uploads only for a signed-in family admin, which it checks by asking Firestore in the project named in `VITE_FIREBASE_PROJECT_ID` (or `FIREBASE_PROJECT_ID`) as the caller — no service account and no dependencies, so it runs on any Node version Vercel is set to.

5. Start the dev server:
   ```bash
   npm run dev
   ```

### The emulators by hand

`npm run dev:local` does these three steps in one; run them separately to keep
the emulators up while restarting the dev server:

```bash
npm run emulators          # Auth, Firestore and Functions emulators
npm run seed:emulator      # seed the demo family
VITE_USE_EMULATOR=true npm run dev
```

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run dev:local` | Emulators + demo data + dev server, no Firebase project needed |
| `npm run build` | Production build incl. static pre-render of `/` |
| `npm test` | Run the Vitest suite |
| `npm run test:rules` | Firestore security-rule tests for "Our Year" (needs the emulator + Java) |
| `npm run test:e2e` | End-to-end smoke tests in Chromium against the seeded emulators (needs Java; Chromium via `npx playwright install chromium`, or `CHROMIUM_PATH`) |
| `npm run lint` | ESLint |
| `npm run emulators` | Firebase Auth + Firestore emulators |
| `npm run seed:emulator` | Seed demo data into the emulator |

## Continuous integration

Every pull request and every push to `main` runs:

| Workflow | What it checks |
| --- | --- |
| `ci.yml` → Lint, test, build | ESLint, the Vitest suite, the production build — and the bundle size, compared with the last build of `main` in the job summary. The *shell* is what every visit downloads before the first paint; a pull request that grows it by more than 10 KB (gzip) gets a warning |
| `ci.yml` → End-to-end smoke tests | `npm run test:e2e`: the landing page, an admin sign-in (and a wrong password) and every main section, in Chromium against the seeded emulators. On failure the Playwright report is attached to the run |
| `firebase-firestore.yml` | The Firestore rules tests; on `main` also the deploy (below) |
| `npm-audit.yml` | Known vulnerabilities in both lockfiles (below) |
| `codeql.yml` | CodeQL security analysis of the JavaScript and of the workflows; findings under Security → Code scanning |
| `actionlint.yml` | The workflow files themselves, when they change |

The actions are pinned to commit SHAs rather than tags, since a tag can be
moved. Dependabot (`.github/dependabot.yml`) opens a weekly pull request that
moves the pins, and one per lockfile for npm minor and patch updates; major
updates come one at a time. The Node version for all of it is in `.nvmrc`.

The Cloud Functions in `functions/` are not deployed from CI yet — see
Getting started.

## Firestore rules & indexes

`firestore.rules` and `firestore.indexes.json` are deployed by GitHub Actions
(`.github/workflows/firebase-firestore.yml`) as soon as a change to either one
lands on `main` — i.e. on merge. The rules tests run on every pull request,
not only on those that touch the rules: they also check that the queries the
client makes are still allowed, and those queries live all over `src/`.

Two repository settings are required (Settings → Secrets and variables →
Actions):

| Name | Type | Value |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | Secret | The complete JSON key of a Google Cloud service account for the Firebase project |
| `FIREBASE_PROJECT_ID` | Variable | The Firebase project id to deploy to |

The service account needs three roles:

| Role | Needed for |
| --- | --- |
| Firebase Rules Admin (`roles/firebaserules.admin`) | Publishing `firestore.rules` |
| Cloud Datastore Index Admin (`roles/datastore.indexAdmin`) | Creating and updating the indexes |
| Service Usage Consumer (`roles/serviceusage.serviceUsageConsumer`) | The CLI checks that `firestore.googleapis.com` is enabled before it deploys anything |

The last one is easy to miss: without it the deploy stops at `ensuring
required API firestore.googleapis.com is enabled` with `HTTP Error: 403,
Permission denied to get service`, before rules or indexes are touched. The
key generated in the Firebase console (Project settings → Service accounts)
does not carry it by default — add it under IAM & Admin → IAM in the Google
Cloud console.

Create the key under IAM & Admin → Service Accounts → Keys → Add key → JSON,
and paste the file's entire contents into the secret.

The deploy runs without `--force`: indexes are created and updated, but an
index that exists in Firebase and is missing from `firestore.indexes.json` is
only reported in the job log, never deleted. Removing an index stays a manual
step in the Firebase console.

## Dependency audit

`.github/workflows/npm-audit.yml` runs `npm audit` on every pull request, on
every push to `main`, and once a week on Mondays — the weekly run is what
catches advisories published after the last merge. It fails as soon as an
advisory of severity **high** or **critical** is open for a dependency in
`package-lock.json` or `functions/package-lock.json`. The run's job summary
lists the packages behind it: severity, whether the package ships to users or is only installed
for development, and whether a fix has been published.

To clear a failing run:

```bash
npm audit               # the full list, lower severities included
npm audit fix           # everything a compatible release fixes
npm audit fix --force   # the rest, with breaking upgrades — test the app afterwards
```

The threshold is `AUDIT_LEVEL` in the workflow; lower it to `moderate` or
`low` once everything above that is cleared. A one-off run at a different
level can be started under Actions → npm audit → Run workflow.

## Access model

- **Viewers** (family & friends): enter the shared family password — read-only, no account, no app install
- **Admins**: Firebase email/password login; create and manage content, design the login page, manage the shared password and invite further co-admins

## License

MIT

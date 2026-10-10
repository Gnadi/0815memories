# Kaydo

A private, encrypted family memory platform — your family's own corner of the internet. Every family claims its own address (`yourname.kaydo.app`) and gets a warm, ad-free space for photos, stories, recipes and letters across generations.

**Live demo:** [kaydo.app/demo](https://kaydo.app/demo) — a demo family that lives in your browser, no account needed · **Website:** [kaydo.app](https://kaydo.app)

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
- **Printed books** — order a scrapbook as a real printed book. Kaydo renders a print-ready PDF (A4 landscape at 300 dpi by default, front cover first, a back cover in the cover's colour, an even page count) and opens a checkout for it at [Peecho](https://www.peecho.com/), where the family picks the product, enters the address and pays Peecho directly. See [Printed books](#printed-books-peecho)
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
- **Printed books are the one deliberate exception for family photos:** a print shop can only print what it can read, so ordering a book creates an unencrypted PDF of it. The order dialog says so before anything is rendered. The file goes to Firebase Storage under `printFiles/{familyId}/…`; `storage.rules` lets only that family's admins write or read it, makes it write-once (the link Peecho holds cannot be pointed at other content), and closes the rest of the bucket. Peecho gets a private download link, and the `purgePrintFiles` Cloud Function deletes every print file after 30 days
- Upload signatures from `api/cloudinary-sign` are handed out only to a family admin — the function asks Firestore, with the caller's own ID token, for the families that list them as an admin, so Firestore verifies the token and the rules decide — viewers never upload, and a signature is write access to the Cloudinary account
- **Our Year** goes further than the rest of the app: instead of trusting the UI, `firestore.rules` decides who may read what. A partner's answers are unreadable until both have handed in, a sealed letter is unreadable until its open date (`request.time`), and a closed chapter can no longer be edited. Those guarantees are covered by emulator tests — `npm run test:rules`
- **Nothing is readable without an identity.** A viewer signs in against a Cloud Function that checks the shared password server-side and issues a token carrying their family; `firestore.rules` gates every collection on that token. Until recently viewers had no Firebase session at all, which forced the family document — encryption key included — to be world-readable. See `docs/plan-a-zugriffskontrolle.md`
- The login page's design is served from `familyPublic/{familyId}`, a mirror written by a Cloud Function from a fixed allowlist, so the public surface of a family cannot grow by accident
- A family's address (`<slug>.kaydo.app`) is unique on the server, not just in the signup form: the same function keeps a `familySlugs` registry and publishes a slug to `familyPublic` only for the family holding it, so a new family cannot take over an existing family's login page by copying its slug
- App feedback is the one collection written *unencrypted* on purpose: it is addressed to whoever runs Kaydo, and ciphertext would make every bug report unreadable to the person who has to act on it. The form says so on screen, `firestore.rules` pins the document to the shape in `src/constants/feedback.js`, and nothing in the app can read the collection back
- The key is written once, with the family. `firestore.rules` refuse any later write that replaces or removes it, so no admin account — and no bug or race between two devices — can leave the family's content unreadable for everyone
- No family is without a key: the rules refuse to create one that has none, and when a family's key is missing or cannot be loaded, the app says so instead of opening — it used to open anyway and write new content unencrypted
- **Deleting:** what a family deletes waits 30 days in its trash, then the `purgeTrash` Cloud Function deletes it for good, with the files only it used; a family's owner can delete the whole family, accounts included. A list of files to delete comes from a client, so the server deletes a file only once it has made sure it is that family's: by the family's own upload folder, or, for files from before those folders, by decrypting it with the family's key and throwing the result away unread. That check is the one place the server uses the key
- **Honest limitation:** the per-family encryption key is stored in the family's Firestore document. It is no longer public — only the family can read it — but it is still readable server-side, so Kaydo is *not* zero-knowledge. Deriving the key from the shared password is the path to that, and the price is that a forgotten password means the data is gone

## Tech stack

- **React + Vite** with **vite-react-ssg** (the landing page is pre-rendered to static HTML)
- **Tailwind CSS** — warm, cozy design system
- **Firebase** — Auth, Firestore, Cloud Functions (viewer login, admin claims, push notifications, print-file clean-up), Cloud Messaging, Cloud Scheduler, Storage (print files only). Deploying functions requires the Blaze plan; all of them run in `europe-west3`
- **Cloudinary** — media storage (signed uploads via the `api/cloudinary-sign` Vercel function)
- **Peecho** — printed books, through Peecho's hosted checkout (optional)
- **Workbox** — PWA service worker
- **i18next** — EN/DE localization
- **Vitest** — test suite

## Getting started

### Just look around

```bash
npm install
npm run dev
```

Then open http://localhost:5173/demo. That is the demo family from the
website: it lives entirely in the browser tab — no Firebase, no Java, no
`.env` — and starts afresh on every reload. See [The demo family](#the-demo-family).

### Run it locally — no accounts needed

```bash
npm install
npm run dev:local
```

That starts the Firebase emulators (Auth, Firestore, Functions, Storage; UI on
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
   - The functions that empty the trash and delete families also delete files on Cloudinary, so they need its API key and secret, the same pair as step 4: `firebase functions:secrets:set CLOUDINARY_API_KEY`, then `CLOUDINARY_API_SECRET`. The deploy asks for `CLOUDINARY_CLOUD_NAME`. Until all three are set, nothing is deleted on the server: the trash and deleted families wait
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
npm run emulators          # Auth, Firestore, Functions and Storage emulators
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
| `npm run test:rules` | Firestore and Storage security-rule tests (needs the emulators + Java) |
| `npm run test:e2e` | End-to-end smoke tests in Chromium against the seeded emulators (needs Java; Chromium via `npx playwright install chromium`, or `CHROMIUM_PATH`) |
| `npm run lint` | ESLint |
| `npm run emulators` | Firebase Auth, Firestore, Functions and Storage emulators |
| `npm run seed:emulator` | Seed demo data into the emulator |

## The demo family

`/demo` opens a family that exists only in the visitor's browser tab: the
Bennetts in English, the Bergers in German, with memories, moments, journals,
a recipe tree, the Vault, scrapbooks, collages, highlight reels and an Our
Year chapter waiting for the visitor's answers. Nothing is sent anywhere and
nothing needs setting up — there is no demo account, no password and no demo
data in Firebase.

It is the real app, not a copy of it. A demo tab never starts Firebase;
every Firestore call goes through `src/config/firestore.js`, which hands it to
an in-memory database (`src/demo/demoDatabase.js`) filled with the family
from `src/demo/demoFamily.js`. Pictures added in the demo stay in the tab as
object URLs. What only a server can do — the viewer password, invite links,
ordering a printed book, push notifications, feedback — says so instead of
pretending. The pictures in `public/demo-media/` are drawn by
`scripts/generate-demo-media.mjs`; replace them with WebP files of the same
names to show photos instead. More in `docs/architecture.md`.

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

## Printed books (Peecho)

Scrapbooks can be ordered as printed books through [Peecho](https://www.peecho.com/),
a print-on-demand network. The feature is off until `VITE_PEECHO_ENABLED=true`;
without it there is no Print button in the editor.

**How an order works.** Kaydo never takes the order or the money. In the
scrapbook editor, **Print** opens a dialog that:

1. Says what will be printed (page count, size) and that the print file is
   unencrypted, before doing anything.
2. Renders the book in the browser, the only place the photos can be decrypted.
   The result is one PDF of single pages: the editor's first page as the front
   cover, the others as the inside, a blank page when needed for an even page
   count, and a plain back cover in the front cover's colour. Pages are
   captured at 300 dpi (`src/utils/printBook.js`). The editor's 4:3 page is
   centred on the print format, and its background fills the difference: 8.5 mm
   either side on A4 landscape. Nothing is cropped.
3. Uploads the PDF and a cover picture to Firebase Storage
   (`src/utils/printUpload.js`).
4. Calls the `createPrintCheckout` Cloud Function (`functions/peechoCheckout.js`).
   It checks that the caller is an admin of the family and that the file is in
   Storage, then creates a Peecho *product listing* for it through Peecho's API
   (`POST /rest/v3/publication/create`) and returns a **secure checkout link**.
   The link is private to whoever holds its token and expires after 7 days,
   well before the file is deleted.
5. Shows **Order at Peecho**, which opens that checkout in a new tab. There the
   family chooses the product, enters the shipping address and pays Peecho;
   Peecho prints and ships the book. Each order carries the print file's id as
   its reference, so an order in the Peecho dashboard can be traced to its
   folder in Storage.

Because the customer pays Peecho directly, no family can run up a bill on the
account behind this deployment. Prices are Peecho's plus the profit markup set
in your Peecho account.

**Setup**

1. Create a Peecho account. Peecho has a **test environment**,
   [test.www.peecho.com](https://test.www.peecho.com), where orders are free and
   never shipped. Start there; it needs its own account and API key.
2. In the Peecho dashboard, under **Settings → API**, fill in your company
   details and copy the **Merchant API key**. Set your profit markup and payout
   details in the account settings.
3. Turn on Firebase Storage for the project (Firebase console → Storage → Get
   started) and make sure `VITE_FIREBASE_STORAGE_BUCKET` is set.
4. Store the key and deploy:
   ```bash
   firebase functions:secrets:set PEECHO_API_KEY   # paste the Merchant API key
   firebase deploy --only storage
   firebase deploy --only functions
   ```
   The functions deploy asks for `PEECHO_API_BASE`: enter
   `https://test.www.peecho.com` for the test environment, or
   `https://www.peecho.com` (the default) for real orders. To switch later,
   change it in `functions/.env.<project-id>` (`PEECHO_API_BASE=…`), set the
   secret to that environment's key, and deploy the functions again.
   The Storage rules read the family document (cross-service rules) for an
   admin whose claim has not arrived yet. If the CLI offers to grant Storage the
   role it needs for that, accept.
5. Set `VITE_PEECHO_ENABLED=true` in Vercel and redeploy. Optionally set
   `VITE_PEECHO_PAGE_WIDTH_MM`/`_HEIGHT_MM` (default A4 landscape, 297 × 210)
   and `VITE_PEECHO_CURRENCY` — see `.env.example`.
6. Order a book end to end in the test environment, then switch to production.

Print files are deleted after 30 days by `purgePrintFiles`
(`PRINT_FILE_RETENTION_DAYS` in `functions/printFiles.js` and
`src/utils/printBook.js`); the order dialog shows the family that number.
`storage.rules` is not deployed by the Firestore workflow. Its tests run with
the others in `npm run test:rules`, which also starts the Storage emulator.

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

`package.json` carries three `overrides`, each for an advisory whose fix the
package that pulls it in has not taken up yet:

- `@grpc/grpc-js` → `^1.14.5`. `@firebase/firestore` asks for `~1.9.0`, which
  has none of the fixes. Only Firestore's Node build uses gRPC — the browser
  talks WebChannel — so what it affects is the rules tests and the build, and
  both pass with it.
- `basic-ftp` → `^6.2.3`. `firebase-tools` reaches it through `proxy-agent` →
  `get-uri`, which asks for `^5`; it would only ever fetch a proxy
  configuration over FTP.
- `chokidar` → `^4`, for `firebase-tools` only. chokidar 3 depends on
  `braces`, which has an open advisory and no fixed release; chokidar 4 has
  dropped it. firebase-tools uses it to watch rules and function sources in
  the emulators, which works the same with either.

Remove each once the package that pulls it in depends on a fixed release
itself.

## Access model

- **Viewers** (family & friends): enter the shared family password — read-only, no account, no app install
- **Admins**: Firebase email/password login; create and manage content, design the login page, manage the shared password and invite further co-admins

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md) — `npm run dev:local` gets you a
running app without any account. [docs/architecture.md](docs/architecture.md)
maps the code, and security problems go through [SECURITY.md](SECURITY.md),
never a public issue.

## License

MIT — see [LICENSE](LICENSE). Bundled data and fonts from others are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

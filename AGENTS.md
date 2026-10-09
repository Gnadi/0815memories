# Working on Kaydo — notes for coding agents

Kaydo is a private, encrypted family memory app: React + Vite in the browser,
Firebase (Auth, Firestore, Cloud Functions) behind it, media on Cloudinary.
Read `docs/architecture.md` for the map and `CONTRIBUTING.md` for the rules;
this file is the short version of both, plus what agents tend to get wrong.

## Commands

| | |
| --- | --- |
| `npm run dev:local` | emulators + demo family + dev server; no credentials needed |
| `npm run lint` | ESLint — errors fail CI |
| `npm test` | Vitest |
| `npm run build` | production build incl. the pre-rendered landing page |
| `npm run test:rules` | Firestore and Storage rules tests (needs Java) |
| `npm run test:e2e` | Playwright against the emulators (needs Java and Chromium; set `CHROMIUM_PATH` to use an installed one) |

Run lint, tests and build before every commit. Run `test:rules` for any
change to `firestore.rules` or to a Firestore query, and `test:e2e` for
changes to sign-in, routing or the seed.

## Rules that are easy to break

- **Authorization lives in `firestore.rules`, not in the UI.** Hiding a
  button protects nothing. Every rules or query change needs a test in
  `src/__tests__/*Rules.test.js`; a new rules test file must be added to the
  `test:rules` script in `package.json`, or it never runs.
- **Family content is encrypted client-side** with `src/utils/encryption.js`
  and `src/utils/encryptedUpload.js`. Never store new family content in
  plaintext, never log decrypted content or keys. The one deliberate
  exception is the print file of a book ordered from Peecho (a print shop
  must read it): Firebase Storage under `printFiles/`, kept to admins and
  write-once by `storage.rules`, deleted after 30 days, and announced in the
  order dialog before it is made.
- **Firestore is read and written in `src/services/`**, one module per area,
  and hooks and pages call those (ESLint enforces it; the files that predate
  the services are listed in `eslint.config.js`, and that list only shrinks).
  Services reach Firestore through `src/config/firestore.js`, never
  `firebase/firestore` directly. That module is where the demo (`/demo`,
  `src/demo/`) swaps Firestore for an in-memory database; a Firestore
  function the app starts to use is added there and to
  `src/demo/demoDatabase.js`, with a test. The demo family's content is
  fictional and stays that way.
- **Every UI string exists in `src/locales/en/` and `src/locales/de/`** with
  the same keys (a test enforces it). New namespaces are registered in
  `src/i18n/`.
- **The landing page is pre-rendered in Node.** Code on public routes must
  not touch `window`, `document` or storage during render.
- **Keep the startup bundle small.** Signed-in features are lazy-loaded;
  don't import them statically from the shell (`src/App.jsx`, public pages).
  CI reports the shell size on every PR.
- **Cloud Functions are v2 in `europe-west3`.** Put testable logic in its own
  module under `functions/` and test it from `src/__tests__/`.
- **Never use real data or real projects.** Use the emulators and the demo
  family from `scripts/seed-emulator.mjs`. No secrets, keys or family data in
  code, tests, fixtures or screenshots.

## Style

- No formatter: match the surrounding file — 2 spaces, single quotes, no
  semicolons.
- Comments explain *why* (a constraint, a past bug, a trade-off), in full
  sentences, at the density of the file you are in. Don't narrate the code.
- Commit subjects are imperative and say what changes ("Show moment save
  errors"); the body explains why. No prefixes like `feat:`.
- Keep changes to the task. Don't reformat, rename or refactor code you
  were not asked to touch.

## Don't

- Don't deploy, and don't run anything against a non-demo Firebase project.
- Don't weaken a rule, skip or delete a test, or lower the audit level to
  get CI green. Fix the cause.
- Don't edit `package-lock.json` by hand; use npm.

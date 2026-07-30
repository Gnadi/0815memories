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
- **Full data export** — download everything as a ZIP of plain, readable files plus structured JSON; NAS-friendly, no lock-in

### Create & evolve
- **Recipe tree** — family recipes with version history, forks and photo logs across generations
- **Digital scrapbook** — freeform drag-and-drop canvas with polaroid frames, stickers and text; export finished books as PDF
- **Login page designer** — give your family's address its own front door, from starter templates to a custom photo welcome page

### Just the two of you
- **Our Year** — a recurring review ritual for a couple, on whatever day they choose, or on no fixed day at all. It holds four things per chapter:
  - a **shared look back**: both partners answer the same five questions independently, and the answers only become visible once both have handed in
  - a **couple's quiz** whose questions are rewritten for every chapter — no points, no winner, different memories welcome
  - a **letter to their future selves** that the server refuses to hand out until the date they picked, so it cannot be read early, not even straight from the console
  - **four keepsakes**: one photo, one song, one sentence, one moment

  Closed chapters become a shared timeline of the relationship. Nothing here assumes marriage, children, or twelve-month cycles, and it is visible to those two accounts only — not even other family admins can see it

### Everyday
- **Two access levels** — viewers enter with one shared family password (no account needed); admins sign in via Firebase Auth. Invite co-admins with secure invite links
- **PWA** — installable on any phone or desktop, instant loads via service-worker precache, push notifications for new memories, anniversary reminders
- **Bilingual** — full English and German UI (i18next)

## Security & encryption

- Photos, videos, voice memos, journal entries, recipes, scrapbooks and Vault content are encrypted **client-side** with **AES-256-GCM** (Web Crypto API) before upload — see `src/utils/encryption.js` and `src/utils/encryptedUpload.js`
- Media is stored as raw ciphertext (Cloudinary `raw` resources); the server never receives a renderable image
- Images deliberately left unencrypted: only the public login-page design assets, which must render before anyone is authenticated
- **Our Year** goes further than the rest of the app: instead of trusting the UI, `firestore.rules` decides who may read what. A partner's answers are unreadable until both have handed in, a sealed letter is unreadable until its open date (`request.time`), and a closed chapter can no longer be edited. Those guarantees are covered by emulator tests — `npm run test:rules`
- **Honest limitation:** the per-family encryption key is currently stored in the family's Firestore document, so Kaydo is *not* zero-knowledge yet. Moving to client-side key derivation is the intended path before any such claim is made

## Tech stack

- **React + Vite** with **vite-react-ssg** (the landing page is pre-rendered to static HTML)
- **Tailwind CSS** — warm, cozy design system
- **Firebase** — Auth, Firestore, Cloud Functions (push notifications, free Spark plan compatible)
- **Cloudinary** — media storage (signed uploads via the `api/cloudinary-sign` Vercel function)
- **Workbox** — PWA service worker
- **i18next** — EN/DE localization
- **Vitest** — test suite

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your Firebase and Cloudinary credentials (see the comments in `.env.example` for details, including the FCM VAPID key for push notifications).

3. Set up Firebase:
   - Create a project at console.firebase.google.com
   - Enable Email/Password authentication
   - Create a Firestore database and deploy `firestore.rules`
   - Optional: deploy the push-notification Cloud Function with `firebase deploy --only functions`

4. Set up Cloudinary and put the API key/secret into your Vercel project (server-side env vars for `api/cloudinary-sign.js`).

5. Start the dev server:
   ```bash
   npm run dev
   ```

### Local development with the Firebase emulator

No real Firebase project needed — seed a demo family (the same one used for the landing-page screenshots):

```bash
npm run emulators          # start Auth + Firestore emulators
npm run seed:emulator      # seed the demo family
VITE_USE_EMULATOR=true npm run dev
```

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build incl. static pre-render of `/` |
| `npm test` | Run the Vitest suite |
| `npm run test:rules` | Firestore security-rule tests for "Our Year" (needs the emulator + Java) |
| `npm run lint` | ESLint |
| `npm run emulators` | Firebase Auth + Firestore emulators |
| `npm run seed:emulator` | Seed demo data into the emulator |

## Access model

- **Viewers** (family & friends): enter the shared family password — read-only, no account, no app install
- **Admins**: Firebase email/password login; create and manage content, design the login page, manage the shared password and invite further co-admins

## License

MIT

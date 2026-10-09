# Contributing to Kaydo

Thanks for wanting to help. Kaydo keeps families' memories — photos, letters,
children's journals — so the bar for correctness and privacy is high, but the
way in is short: you can run the whole app on your machine without any
account.

- **Found a bug or have an idea?** [Open an issue](https://github.com/Gnadi/0815memories/issues/new/choose).
- **Found a security problem?** Not as an issue — see [SECURITY.md](SECURITY.md).
- **Want to write code?** Read on. For anything bigger than a small fix,
  open an issue first so we can agree on the approach before you spend the
  time.

Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Set up

You need Node 22 (`.nvmrc`) and Java 11+ for the Firestore emulator — or open
the repository in GitHub Codespaces or a VS Code Dev Container, which bring
both.

```bash
npm install
npm run dev:local
```

That starts the Firebase emulators, seeds a demo family and serves the app on
http://localhost:5173. The sign-ins are in the README under *Getting started*.
You never need access to the hosted service or its Firebase project, and you
should not test against it: it holds real families' data.

To look at a change without the emulators, `npm run dev` and open `/demo`:
the demo family runs entirely in the browser, with no Java and no `.env`.

## Before you open a pull request

Run what CI runs:

| Command | Checks | Needs |
| --- | --- | --- |
| `npm run lint` | ESLint (errors fail CI; warnings don't) | — |
| `npm test` | The Vitest suite | — |
| `npm run build` | The production build and the pre-rendered landing page | — |
| `npm run test:rules` | The Firestore rules against the emulator | Java |
| `npm run test:e2e` | Sign-in and every main section in Chromium | Java, `npx playwright install chromium` |

CI also runs CodeQL, `npm audit` and, when workflows change, actionlint.

## How the code is written

There is no formatter; match the file you are in. In practice: 2-space
indentation, single quotes, no semicolons, and comments that say *why*
something is the way it is rather than what the next line does.

A few rules the codebase depends on:

- **Every user-facing string goes through i18next, in English and German.**
  Strings live in `src/locales/{en,de}/<namespace>.json`, and a test fails
  when the two languages have different keys. A new namespace must also be
  registered as eager or lazy in `src/i18n/` — `src/i18n/index.js` explains
  which is which. If you don't speak German, add the English text in both
  files and say so in the pull request; someone will translate it.
- **Family content is encrypted in the browser before it is stored.** New
  content fields and uploads go through `src/utils/encryption.js` and
  `src/utils/encryptedUpload.js`. Anything stored unencrypted needs a reason
  in the code and the pull request.
- **`firestore.rules` decides who may read and write what — not the UI.** A
  change to the rules, or a new query the client makes, comes with a test in
  `src/__tests__/*Rules.test.js`. A new rules test file must also be added to
  the `test:rules` script in `package.json`, or it never runs. A query that
  needs a composite index adds it to `firestore.indexes.json`.
- **Firestore is read and written in `src/services/`**, one module per
  area: its queries, its encryption and the shape of what it writes. Hooks
  and pages call the services, and ESLint refuses Firestore imports anywhere
  else (the files from before the services are listed in `eslint.config.js`
  until their area moves over). A list subscribes through
  `subscribeDecrypted`, a page loads its document through the area's `get…`.
- **Services reach Firestore through `src/config/firestore.js`.** It is where
  the demo swaps Firestore for its in-browser database (`src/demo/`), and
  ESLint refuses `firebase/firestore` imports anywhere else in `src/`. A
  Firestore function the app starts to use goes into that module and into
  `src/demo/demoDatabase.js`, with a test in
  `src/__tests__/demoDatabase.test.js`.
- **Cloud Functions are v2 and run in `europe-west3`**, set once at the top
  of `functions/index.js`. Logic worth testing lives in its own module
  (`functions/viewerLogin.js`, `functions/slugs.js`, …) so the tests can
  import it without the Functions runtime.
- **Tests live in `src/__tests__/`.** A bug fix comes with a test that fails
  without it, where that is at all possible.

## Commits and pull requests

Write commit messages the way the history does:

- a subject in the imperative that says what changes for the user or the
  code — "Show moment save errors", not "fix bug" or "update file" — with no
  prefix and no trailing period
- a body that explains *why*: what was wrong or missing, what the change
  does about it, and anything a reviewer would otherwise have to work out

Keep a pull request to one concern. Fill in the template, link the issue,
and add screenshots for anything visible. CI must be green before review.
Changes to the rules, the functions, `api/`, encryption or the workflows are
reviewed by a code owner (`.github/CODEOWNERS`).

### Using AI tools

Much of this codebase was written with AI assistance, and you are welcome to
use it too. You are still the author: read and understand every line you
submit, run the checks above yourself, and be ready to explain the change in
review. `AGENTS.md` describes the project's conventions for coding agents.

## License

Kaydo is released under the [MIT License](LICENSE). By contributing, you
agree that your contribution is licensed under the same terms.

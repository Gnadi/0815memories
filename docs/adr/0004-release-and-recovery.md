# 0004 — Shipping together, and getting a family's data back

Status: proposed

## What is true today

**Release.** Three things have to agree: the app (Vercel), the rules and
indexes, and the Cloud Functions.

- `.github/workflows/firebase-firestore.yml` deploys `firestore.rules` and
  `firestore.indexes.json` on a merge to `main`.
- Functions and `storage.rules` are deployed by hand (`README.md`, "firebase
  deploy --only storage" and "--only functions").
- So after a merge the rules are new, the app is new within minutes, and the
  functions are old until someone remembers. Two recent changes depended on
  all three (viewer login throttle with storage rules; invite epoch and viewer
  session version with three functions). Both were written to tolerate the
  gap — an invite without an epoch and a viewer token without a version keep
  working until first use — but nothing makes the next change do the same.
- A new composite index builds for minutes after the deploy; queries that need
  it fail until then.

**Recovery.** The repository has no restore procedure for the database, the
media or the key.

- The NAS export (`src/services/nasExport.js`) is a family's own copy of what
  it may read. It leaves out what the family may not read yet (a sealed
  capsule's letter, a sealed Our Year letter), so it is not a backup of the
  system.
- The family key lives in the family document, so a database backup contains
  the key and a restored database can read restored media. Media on Cloudinary
  is a second system with its own lifetime: a restored database can point at
  files the clean-up has deleted since.
- Whether backups exist outside the repository cannot be seen from here.

## Options

**Release**

- **A — Checklist.** A release note template listing "needs functions deploy",
  "needs storage deploy", "new index". Costs nothing, relies on memory.
- **B — CI deploys everything.** The workflow also deploys functions and
  storage rules, in a fixed order (functions, then rules and indexes), behind a
  GitHub environment with required approval and the secret moved into it. The
  service account needs the roles for functions. Index builds are waited for
  before the job reports success.
- **C — B plus a compatibility rule.** Every change to a contract between app,
  rules and functions must work with the other side one version back, and says
  in its PR how. A `releaseVersion` written by the deploy lets the app show
  "reload for the new version" instead of failing.

**Recovery**

- **A — Managed backups, written down.** Turn on Firestore scheduled backups
  (and point-in-time recovery if the plan has it), check what the Cloudinary
  plan offers for backup of deleted assets, and write `docs/recovery.md`: what
  is backed up, how long, who can restore, in which order.
- **B — A plus a rehearsal.** Restore into a scratch project once, with the
  demo family, and record what did not work. Repeat when the data model
  changes. Keep the media clean-up's retention (`functions/mediaPurge.js`)
  longer than the oldest database backup that may be restored, so a restored
  document never points at a deleted file.

## Recommendation

Release C, reached through B: the two recent changes show the gap is real, and
the compatibility habit already exists informally. Recovery B: for an app whose
promise is that memories last, an untested backup is a guess. The retention
rule in recovery B is a hard requirement before the media clean-up leaves its
dry run.

## Open questions

- Which backups exist today outside the repository?
- May CI hold a credential that can deploy functions, or should that stay a
  manual step with a script that checks the deployed version afterwards?

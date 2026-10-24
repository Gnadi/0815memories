# Media lifecycle — who may upload, and when a file goes away

Cloudinary is the one place in Kaydo that only ever grows. Anyone who can get an
upload signature can store anything there, and nothing the app does ever
removes a file again. This plan reorganises uploads so that every file has an
owner, a reason to exist, and an end.

Phases 1 to 5 are built. Each claim about the code points at a
file.

## What is wrong today

**A signature is a blank cheque.** `api/cloudinary-sign.js` (removed after
phase 2) signs only `folder` and `timestamp`. Cloudinary accepts a timestamp for an hour, so one signature
is good for any number of uploads in that hour, of any `resource_type` (it is
part of the URL, not of the signature), encrypted or not: without a query the
endpoint signs the plain `image/upload` into `kaydo/`, which is what
`UploadWidget.jsx` uses for the login header. The files are publicly
deliverable from `res.cloudinary.com`.

**Every admin can get one, and anyone can become an admin.** Signup founds a
family (`AuthContext.jsx`, `createFamily`), and since "Require a confirmed email
address to become an admin" the rules ask for `email_verified` first
(`hasVerifiedEmail` in `firestore.rules`). That stops typos and borrowed
addresses. It does not stop a disposable mailbox: becoming an admin still costs
a minute, and an admin's signature is still unlimited. Admins from before the
check need no confirmed address at all.

**Nothing is ever deleted.** No code calls Cloudinary's destroy or Admin API.
Deleting a moment, memory, recipe or Black Box removes the document and leaves
the original and its thumbnail behind. Uploads happen when a file is picked,
before anything is saved (`useMediaUploader.js`, `RichTextEditor.jsx`), so an
editor that is closed without saving leaves its files behind too. A rerun of
the thumbnail migration (`thumbnailMigration.js`) leaves the thumbnail it
replaces.

**The server cannot see what is referenced.** `images` and `thumbs` are plain
URL arrays, but media inside rich text is encrypted with the rest of
`contentRich` (`memories.js`). A server-side scan of the documents cannot tell
which files are still in use, and must never guess: deleting a file that is
referenced loses a family's photo for good.

### What is fine

Thumbnails are a separate file on purpose: Cloudinary only sees ciphertext and
cannot resize it, so the 1024 px WebP is made in the browser
(`imageThumbnail.js`) and costs a few percent of the original's storage for a
large saving in bandwidth. The 20 px blur-up preview is not on Cloudinary at
all; it is encrypted text on the document (`thumbsTiny`). Neither changes here.
They only need to be deleted along with their original.

## The shape of the fix

One ledger, written only by the server, that knows every file:

```
mediaAssets/{assetId}
  familyId, uid          who uploaded it, for which family
  publicId, resourceType where it is on Cloudinary
  kind                   'encrypted' | 'public' (the login header)
  bytes                  from Cloudinary's upload notification
  state                  'pending' | 'attached' | 'detached'
  refs                   document paths that reference it
  createdAt, detachedAt
```

- **Signing names the file.** The server picks the `public_id`
  (`kaydo/<familyId>/<random>`), signs it, and writes the ledger entry as
  `pending` before it answers. One signature is one file: it also signs
  `overwrite=false`, so a second upload with it lands on the same `public_id`
  and stores nothing new (signed uploads overwrite by default).
- **Documents say what they use.** Every document that holds media gets a
  plain `mediaRefs` map — for each field, the public ids of the files in it —
  written by its service next to the encrypted fields. A map rather than one
  list, because most writes are partial and must only replace the entries of
  the fields they write. The ids are random and point at ciphertext, so they reveal no more than the
  URLs the documents already carry in clear text, and they are the only way the
  server can learn about media inside encrypted rich text.
- **A trigger keeps the ledger.** When a document's `mediaRefs` change, ids that
  were added are attached (with the path in `refs`), and ids that were removed,
  or all of them when the document is deleted, lose that path. An asset with no
  refs left becomes `detached`. An id whose ledger entry belongs to another
  family is ignored, so one family cannot keep another's files alive or touch
  them.
- **A schedule deletes.** `pending` older than a week (an abandoned editor)
  and `detached` older than 30 days (time to notice a mistake) are destroyed on
  Cloudinary, then removed from the ledger. Only assets in the ledger are ever
  deleted; a file the ledger does not know is never touched.
- **Quotas apply at signing.** The ledger is what makes them possible: uploads
  per uid per hour, and stored bytes per family, checked before a signature is
  issued.

## Phases

Each phase can ship and be reverted on its own, and none deletes anything
before phase 4.

### Phase 1 — Signing moves to a Cloud Function (done)

- `functions/mediaSigning.js`: pure logic (admin check, public id, ledger
  entry, parameters to sign), tested from `src/__tests__/mediaSigning.test.js`.
- `signUpload` in `functions/index.js`: `onCall`, `europe-west3`, App Check as
  the other callables, Cloudinary key and secret from Secret Manager
  (`defineSecret`, as `PEECHO_API_KEY`). It checks admin status with the Admin SDK, writes the
  `pending` ledger entry, and signs `public_id`, `overwrite=false`,
  `timestamp` and `tags` (`family:<id>`). The family is the one the session
  works in (`fh_familyId`), checked against the family document.
- `kind: 'public'` signs `image` into `kaydo/public/`; everything else signs
  `raw`. The client asks for a kind, not a folder.
- `src/utils/uploadSignature.js` calls the function instead of
  `/api/cloudinary-sign`. `encryptedUpload.js` and `UploadWidget.jsx` send the
  `public_id` they were given.
- `mediaAssets` is `allow read, write: if false` in `firestore.rules`, with a
  test in `src/__tests__/mediaAssetsRules.test.js` (added to `test:rules`).
- The Vercel endpoint is gone. Clients update themselves (`autoUpdate`,
  `skipWaiting`, `clientsClaim`), so only a tab left open across the deploy
  still asks it, and gets a failed upload until it reloads. The Cloudinary
  variables on Vercel can be deleted.

### Phase 2 — Uploads report their size (done)

- `signUpload` adds `notification_url` to the parameters it signs, outside the
  emulator.
- `cloudinaryNotification` (`onRequest`, `functions/mediaNotification.js`):
  verifies Cloudinary's signature over the raw body (SHA-1 or SHA-256, at most
  a day old), then writes `bytes` to the ledger entry named by the `public_id`
  and adds it to `mediaUsage/{familyId}`, once per file. An unknown
  `public_id` is logged and ignored.
- `signUpload` checks, in the transaction that records the file, the admin's
  uploads this hour (`mediaRates/{uid}`, a fixed window) and the family's
  stored bytes. The limits are parameters with generous defaults —
  `MEDIA_UPLOADS_PER_HOUR` (600) and `MEDIA_FAMILY_STORAGE_MB` (10240) — so
  they change without a change of code. A refusal is `resource-exhausted` with
  the reason, and the browser says which limit was reached
  (`upload.rateLimited`, `upload.storageFull`).
- Usage counts only files signed since phase 1. What a family stored before is
  counted once phase 5 has an inventory of it.
- `mediaUsage` and `mediaRates` are closed to clients like the ledger.

### Phase 3 — Documents declare their media (done)

- `src/services/mediaRefs.js` works out `mediaRefs` from the plaintext a
  service is about to write: every public id signUpload made, found in URLs,
  bare ids, lists, maps and JSON strings such as rich documents.
  `mediaRefsForCreate` for a whole document, `mediaRefsForUpdate` (field paths)
  for a partial one, `mediaRefsForMerge` for `setDoc` with merge. A partial
  write replaces the entries of the fields it writes and no others.
- Every write of media goes through them: `memories` (and the conversions to
  and from moments), `moments`, `children`, `journals`, `blackbox` and
  `blackboxContent`, `scrapbooks`, `collages`, `highlights`, `bestOf` (the
  photos inside the encrypted story), `recipes`, `ourYearChapters`
  (keepsakes), the family document (login page pictures), and the thumbnail
  backfill.
- `trackMediaReferences`, one `onDocumentWritten('{collection}/{docId}')` for
  all of them, logic in `functions/mediaRefs.js`. It returns at once for a
  collection not in `MEDIA_COLLECTIONS` or a write that left `mediaRefs` as it
  was; otherwise it attaches and lets go in one transaction per file. A file no
  document ever held stays `pending`; one whose last document let it go
  becomes `detached` with `detachedAt`; one picked up again is `attached`.
- Rules: only `bestOf` lists its fields, and now allows `mediaRefs` as a map.
  Every other collection already accepted extra fields.
  `src/__tests__/mediaRefsRules.test.js` writes through the rules and runs the
  trigger's logic on what Firestore made of it.
- Not tracked: files from before the ledger (their ids have another shape),
  and the Black Box migration, which only moves such files.
- For phase 4: a file uploaded in an editor left open for a long time
  before saving stays `pending` until the save. Phase 4 therefore waits a week
  before it deletes a pending file, not a day.

### Phase 4 — Deletion, first as a dry run (done)

- `purgeUnusedMedia` (`onSchedule`, daily at 04:15 Europe/Berlin), logic in
  `functions/mediaPurge.js`: selects `pending` entries older than 7 days and
  `detached` ones older than 30 (two composite indexes on `mediaAssets` in
  `firestore.indexes.json`), at most 500 of each per run.
- Each file is read again right before it goes, and kept if a document picked
  it up since the query. Cloudinary's Admin API destroys them a hundred at a
  time per resource type (original and thumbnail are separate entries, so both
  go); `not_found` counts as gone. An entry leaves the ledger, and its bytes
  the family's usage, only once Cloudinary confirmed, in a transaction that
  checks once more that it is still due. A refused destroy changes nothing,
  so the next run tries again.
- It ships with `MEDIA_PURGE_DRY_RUN=true` and only logs the public ids it
  would delete. It also needs `CLOUDINARY_CLOUD_NAME`; without it, it reports
  only. It is switched on only after a few weeks of logs show nothing that is
  still in use.

### Phase 5 — Files from before the ledger (done)

Existing files have no ledger entry and existing documents no `mediaRefs`, so
phase 4 leaves them alone — correct, but it means old orphans stay.

What changed from the first draft of this phase: those files were uploaded
without a family tag into folders every family shared (`kaydo/encrypted`,
`kaydo/videos`, `kaydo/audio`, `kaydo`), so Cloudinary cannot say whose they
are, and a per-family inventory is not possible. Documents can say it, so the
work is split between the families' browsers and a report for the operator.

- `src/services/mediaRefs.js` also recognises the delivery URLs of old files
  and names them `legacy:<resourceType>/<publicId>` (their ids are unique per
  resource type only). Every write since then carries them.
- The trigger gives such a file an entry the first time a document of a
  family names it — ledger id `legacy~<type>~<encoded public id>`, marked
  `legacy`. A file a family names that another family named first stays with
  the first. When no document holds it any more it becomes `unused`, not
  `detached`, and `isDue` refuses legacy entries anyway: nothing proves which
  family uploaded an old file, so naming one must never be a way to get it
  deleted.
- `src/services/mediaIndex.js`, run from the settings ("Fotos und Videos
  erfassen", `MediaIndexPanel`): goes through every media document of the
  family, decrypts it, and writes its whole `mediaRefs` in a transaction. No
  media is downloaded. A sealed capsule's letter and a closed chapter are
  refused by the rules and skipped. A run that gets through everything notes
  `mediaIndexedAt` on the family document.
- `reportLegacyMedia` (weekly, Mondays 05:15), logic in
  `functions/mediaInventory.js`: lists every file under `kaydo/` through the
  Admin API, counts the size of each claimed old file into its family's usage
  once, and writes `mediaReports/<date>` (closed to clients) with the totals,
  the unclaimed files (count, bytes, the first 50 by name) and how many
  families have not run the backfill. It deletes nothing.
- Deleting unclaimed old files is the operator's decision, in Cloudinary, and
  only sensible once `familiesNotIndexed` is 0: until then an unclaimed file
  may belong to a family that has not run the backfill. Files outside `kaydo/`
  are not looked at.

### Phase 6 — Words

- `docs/architecture.md`: the ledger, the trigger, the purge.
- `src/locales/*/landing.json`: check what it says about storage and deletion.
  Saying deleted memories are removed from storage becomes true after phase 4,
  not before.

## Decisions to make

- **Grace period for detached files.** 30 days is a guess. Shorter saves
  storage; longer survives a mistaken delete noticed later. There is no undo in
  the app today, so the period only matters if one is built.
- **Quota sizes.** Uploads per uid per hour, and bytes per family. They depend
  on the Cloudinary plan, and should be generous enough that a family
  importing a holiday never notices them. The defaults (600 uploads an hour,
  10 GB a family) are a starting point.
- **Signup.** Quotas limit what one account can store. They do not limit how
  many accounts someone opens. If that becomes a problem, the next step is
  founding a family by invitation or waiting list, which is a product decision
  rather than a technical one.

## Tests

- Unit: `mediaSigning`, `mediaRefs` (attach, detach, foreign family ignored,
  document deleted), `mediaPurge` (due selection, dry run, failed destroy keeps
  the entry), `mediaRefs` (rich document, empty, demo).
- Rules: `mediaAssets` closed to clients; `mediaRefs` accepted on every media
  collection, as a list of strings only.
- E2E against the emulators: upload, save, delete a moment, and see the ledger
  move from `pending` to `attached` to `detached`.

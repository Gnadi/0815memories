# Media lifecycle — who may upload, and when a file goes away

Cloudinary is the one place in Kaydo that only ever grows. Anyone who can get an
upload signature can store anything there, and nothing the app does ever
removes a file again. This plan reorganises uploads so that every file has an
owner, a reason to exist, and an end.

Phase 1 is built; the rest is not yet. Each claim about the code points at a
file.

## What is wrong today

**A signature is a blank cheque.** `api/cloudinary-sign.js` signs only `folder`
and `timestamp`. Cloudinary accepts a timestamp for an hour, so one signature
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
  plain `mediaIds` array, written by its service next to the encrypted fields.
  The ids are random and point at ciphertext, so they reveal no more than the
  URLs the documents already carry in clear text, and they are the only way the
  server can learn about media inside encrypted rich text.
- **A trigger keeps the ledger.** When a document's `mediaIds` change, ids that
  were added are attached (with the path in `refs`), and ids that were removed,
  or all of them when the document is deleted, lose that path. An asset with no
  refs left becomes `detached`. An id whose ledger entry belongs to another
  family is ignored, so one family cannot keep another's files alive or touch
  them.
- **A schedule deletes.** `pending` older than 24 hours (an abandoned editor)
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
- The Vercel endpoint stays until the new client has been live for a release,
  then goes, together with `CLOUDINARY_API_SECRET` on Vercel.

### Phase 2 — Uploads report their size

- `signUpload` adds `notification_url` to the parameters it signs.
- `cloudinaryNotification` (`onRequest`): verifies Cloudinary's signature on
  the notification, then writes `bytes` to the ledger entry named by the
  `public_id`. An unknown `public_id` is logged and ignored.
- With sizes known, `signUpload` enforces the family's storage quota and the
  per-uid rate. Limits are parameters (`defineString`), so they change without
  a deploy of code.
- The upload error the user sees for a refused quota gets its own string in
  `src/locales/en/` and `src/locales/de/`.

### Phase 3 — Documents declare their media

- `src/utils/mediaIds.js`: one helper that derives `mediaIds` from what a
  service is about to write — URL arrays, thumbnails, and the media nodes of a
  rich document before it is encrypted. Every service that writes media uses
  it: `memories`, `moments`, `collages`, `highlights`, `recipes`, `kids`,
  `scrapbooks`, `ourYear` (keepsakes), `journals`, `blackbox`, `family` (login
  header, Polaroid border).
- The rules of those collections allow `mediaIds` as a list of strings, with
  tests in the matching `*Rules.test.js`.
- `trackMediaRefs` (`onDocumentWritten` on each of those collections), logic
  in `functions/mediaRefs.js`: diff of `mediaIds`, then the ledger update in a
  transaction.
- `src/config/firestore.js` and `src/demo/demoDatabase.js` need nothing new as
  long as the services use only functions already there. The demo uploads
  nothing and writes empty `mediaIds`.

### Phase 4 — Deletion, first as a dry run

- `purgeMedia` (`onSchedule`, daily), logic in `functions/mediaPurge.js`:
  selects due `pending` and `detached` entries, destroys them on Cloudinary in
  batches (original and thumbnail are separate entries, so both go), and
  removes the entries whose destroy succeeded.
- It ships with `MEDIA_PURGE_DRY_RUN=true`: it logs what it would delete and
  deletes nothing. It is switched on only after a few weeks of logs show
  nothing that is still in use.

### Phase 5 — Files from before the ledger

Existing files have no ledger entry and existing documents no `mediaIds`, so
phase 4 leaves them alone — correct, but it means old orphans stay.

- A backfill in the admin's browser, built like the thumbnail migration
  (resumable, re-derives its progress from the data): it decrypts each
  document, writes `mediaIds`, and the trigger attaches them. It has to run in
  the browser because only there can rich text be read.
- `inventoryMedia` (admin-only callable): lists the family's Cloudinary assets
  and creates `legacy` ledger entries for those no document claims.
- `legacy` entries are reported to the admin, never purged automatically. A
  family decides about its own old files.

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
  importing a holiday never notices them.
- **Signup.** Quotas limit what one account can store. They do not limit how
  many accounts someone opens. If that becomes a problem, the next step is
  founding a family by invitation or waiting list, which is a product decision
  rather than a technical one.

## Tests

- Unit: `mediaSigning`, `mediaRefs` (attach, detach, foreign family ignored,
  document deleted), `mediaPurge` (due selection, dry run, failed destroy keeps
  the entry), `mediaIds` (rich document, empty, demo).
- Rules: `mediaAssets` closed to clients; `mediaIds` accepted on every media
  collection, as a list of strings only.
- E2E against the emulators: upload, save, delete a moment, and see the ledger
  move from `pending` to `attached` to `detached`.

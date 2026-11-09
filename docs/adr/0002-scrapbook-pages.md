# 0002 — Scrapbooks stored page by page, with conflict detection

Status: proposed

## What is true today

- A scrapbook is one document. All pages are one encrypted JSON value in
  `pages` (`encryptScrapbook`, `src/services/scrapbooks.js`); `pageCount` sits
  next to it in clear because the overview cannot measure ciphertext.
- Autosave writes the whole value back after every pause in editing
  (`src/hooks/useAutosave.js`, used by `src/pages/ScrapbookEditorPage.jsx`).
  The save queue orders the writes of one editor. Nothing compares against
  what is stored: no revision, no precondition. A second device that saves
  later replaces the first device's pages without either noticing.
- The overview subscribes to every scrapbook of the family
  (`subscribeScrapbooks`). `withPages: false` skips decrypting the pages; the
  ciphertext is still downloaded with each document.
- A Firestore document holds at most 1 MiB. Photos are referenced by URL, not
  embedded, so a book is far from that today; the ceiling is real for very
  large books because base64 ciphertext is a third bigger than its JSON.

## Options

**A — Revision on the one document.** Add a `revision` counter. A save runs in
a transaction that refuses to write unless the stored revision is the one the
editor loaded, then raises it. On refusal the editor keeps the local state and
asks: reload, or overwrite. Small change, closes the silent overwrite. Does not
help the overview or the size.

**B — Pages as documents.** `scrapbooks/{id}` keeps metadata (title, cover,
`pageCount`, page order); `scrapbooks/{id}/pages/{pageId}` holds one encrypted
page with its own `revision`. A save writes only pages that changed, each with
the precondition from A. Two devices editing different pages no longer
conflict at all; the overview downloads metadata only; the size limit applies
per page. Needs rules for the subcollection, the media-reference map per page
(`functions/mediaRefs.js` reads `mediaRefs` from the document that holds it),
delete as a batch, export and print reading pages, and a migration that splits
existing books on first open.

**C — B with merging.** As B, and a conflict on one page is merged element by
element instead of asking. Much more work; the editor's elements have no
stable merge semantics today.

## Recommendation

A first, as its own change: it is small and ends the only way this design
loses work without telling anyone. Then B when the overview's download size or
a book's size is felt. C only if families really edit one page together.

## Cost

- A: small — service, editor dialog, rules test, two locale strings.
- B: large — touches storage, rules, media references, export, print, demo
  data and a migration.

## Open questions

- What should the conflict dialog offer: keep mine, take theirs, or both as a
  copy of the book?
- Is the page order part of the metadata document (one more place two devices
  can collide) or derived from a sort key on each page?

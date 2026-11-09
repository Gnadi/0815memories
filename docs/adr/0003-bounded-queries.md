# 0003 — Lists that grow with a family's history

Status: proposed

## What is true today

The home feed is bounded. These are not:

- **Recipes.** The overview loads every recipe of the family, forks included,
  and derives roots and version counts in the browser
  (`src/services/recipes.js`, the count over `rootId`).
- **Scrapbooks.** The overview subscribes to all books, pages included as
  ciphertext (see record 0002).
- **Year view.** `rangeQuery` in `src/services/timeline.js` loads every memory
  of a year.
- **NAS export.** `src/services/nasExport.js` collects all media, then builds
  one ZIP in memory (`zip.generateAsync({ type: 'blob' })`). A large family's
  export needs its whole size in browser memory and starts over if the tab
  closes.
- **Indexes.** `firestore.indexes.json` has no `fieldOverrides`, so Firestore
  keeps its automatic single-field indexes for every field, ciphertext
  included. Those fields are never queried.

None of this is slow for a young family. A memory app's data grows for
decades per family, so the cost arrives late and for the most loyal users.

## Options, per list

- **Recipes:** keep `forkCount` on the root (maintained in the batch that adds
  or removes a fork, which `src/services/recipes.js` already writes) and query
  roots only, paginated by `createdAt`.
- **Scrapbooks:** solved by 0002 B; until then, paginate the overview.
- **Year view:** paginate by month within the year (cursor on `date`), or load
  a per-month count first and the months on demand.
- **Export:** write the archive in parts of a fixed size, with a manifest that
  records what is done so a later run continues; or stream to disk where the
  browser offers the File System Access API, with the in-memory ZIP as the
  fallback.
- **Indexes:** add `fieldOverrides` that switch indexing off for encrypted
  fields. Saves index storage and write cost; no behaviour change. Needs care:
  an exemption on a field some query does use breaks that query, so each one
  is checked against `src/services/`.

## Recommendation

In this order: index exemptions (cheap, pure saving), recipe roots with
`forkCount`, export in parts, year view. Each is its own change with its own
rules test where the query changes (`AGENTS.md`).

A rule for new code, to stop the list from growing again: a query in
`src/services/` has a `limit`, or a comment that says why its result is small
by construction. An ESLint rule can ask for one of the two.

## Open questions

- How large is the largest family today (memories, media bytes)? That decides
  how soon the export matters.
- Should the export stay a browser feature, or become a function that writes
  to the family's own storage target?

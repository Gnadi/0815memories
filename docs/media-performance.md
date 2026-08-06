# Photo pipeline — where the time goes, and what to do next

Written alongside the decrypt spinner (`.media-decrypting`). Making the wait
visible is only worth doing if the wait then gets shorter, so this is the
analysis that goes with it: what the pipeline actually costs today, and the
changes worth making, in the order they pay off.

Nothing here is speculative about the code — every claim points at a file. The
numbers are measured where it says so and reasoned where it says so.

## The path a photo takes

```
Firestore doc ──> images[i] / thumbs[i]        (Cloudinary raw URL, ciphertext)
                       │
                       ├─ IntersectionObserver gate      useDecryptedMedia (lazy: true)
                       ├─ queue, 6 slots                 useDecryptedMedia pending[]
                       ├─ fetch()                        SW: CacheFirst, encrypted-media-cache
                       ├─ AES-256-GCM                    decryptPool → ≤3 workers
                       ├─ sniff magic bytes, re-type Blob
                       ├─ URL.createObjectURL
                       └─ LRU cache, 150 MB              useDecryptedMedia cache
```

## Decryption is not the bottleneck — bytes are

AES-256-GCM throughput for the payload sizes this app moves, measured with
`crypto.subtle` on Node 22 / Xeon @ 2.80GHz (this container). Phone silicon has
ARMv8 crypto extensions too; expect roughly 3–5× slower, not orders of magnitude.

| payload | size | decrypt |
| --- | ---: | ---: |
| 16px inline preview (proposal 2) | 0.7 KB | 0.19 ms |
| 256px micro thumb (proposal 1) | 15 KB | 0.25 ms |
| 1024px thumb (today) | 180 KB | 1.9 ms |
| 12MP original | 4 MB | 8.1 ms |
| large original | 8 MB | 36 ms |

A 4 MB original decrypts in single-digit milliseconds. Downloading those same
4 MB over mobile data takes one to three *seconds*. The worker pool in
`utils/decryptPool.js` was the right call — it keeps those milliseconds off the
main thread during scroll — but there is no meaningful time left to win in the
crypto itself.

So every proposal below is about one of three things: **transfer fewer bytes**,
**start the right transfer first**, or **show something before the bytes land**.

## Proposals, highest value first

### 1. A second, smaller derivative — transfer fewer bytes

`utils/imageThumbnail.js` produces exactly one derivative, `THUMBNAIL_MAX_EDGE
= 1024`, WebP q0.75 — typically 120–250 KB. That one file is what every surface
downloads:

| surface | displayed at | downloads |
| --- | --- | --- |
| `DailyMoments` story circle | 64 px | 1024 px thumb |
| `KidJournalCard` avatar | 64 px | full original (no `thumbSrc`) |
| `MomentsAllPage` grid tile | ~180 px (2 cols on a phone) | 1024 px thumb |
| memory feed card | ~400–768 px | 1024 px thumb |

The 1024 px size is right for the feed card. For a 64 px story circle it is
sixteen times the linear resolution the screen can use — in bytes, closer to two
orders of magnitude. A second derivative at 256 px (~10–20 KB) for circles,
avatars and grid tiles would cut cold-load bytes on those surfaces by roughly
10×.

The additive-companion-array pattern in `utils/mediaThumbs.js` is already built
for this: add `thumbsSm` next to `thumbs`, same strict length check, same
fall-back-to-the-larger-thing-on-any-mismatch rule. `needsThumbs()` and
`OptimizePhotosPanel` already exist to backfill old documents.

**Effort:** medium — upload path, one companion field, backfill, ~6 call sites.

### 2. A tiny preview inside the Firestore document — show something immediately

The reason there is no blur-up placeholder is structural: Cloudinary stores
these as `raw` because it cannot transform bytes it cannot read, so there is no
server-side derivative to ask for, and *any* preview costs a full round trip.

Unless the preview travels with the document. A 16–24 px WebP encrypts to a few
hundred bytes; as base64 ciphertext in a `thumbsTiny` array it arrives, and
decrypts, with the text fields the feed already decrypts. Measured above: 0.19 ms
each, so 50 of them cost ~10 ms total and zero requests.

That replaces the spinner with a blurred version of the actual photo, which is
the single largest perceived-performance change available here. Firestore's
1 MiB document limit is not a concern at ~700 B × images.

**Effort:** medium — upload path, one field, one render branch in the media
components. **Impact:** the largest of anything on this list.

### 3. Give the decrypt queue two priorities — start the right transfer first

`useDecryptedMedia` has one 6-slot lane (`pending`, `pump()`), and
`prefetchDecryptedMedia` enqueues into the same one. So opening a lightbox while
the feed is still filling puts the photo the user is looking at *behind* up to
six off-screen prefetches — and a full-resolution original behind a queue of
thumbnails is a wait measured in seconds.

Splitting `pending` into foreground and prefetch tiers, and only pumping the
prefetch tier when the foreground tier is empty, is roughly twenty lines in one
file. It is the change most directly aimed at the wait the new spinner makes
visible.

**Effort:** small. **Impact:** high, and only on the interactions users notice.

### 4. `MemoryHero` — no thumbnail, no neighbour prefetch

`MomentViewer` prefetches the next and previous media on every index change
(`MomentViewer.jsx:150-168`). `MemoryHero` does neither: it passes no
`thumbSrc`, so both the hero and its dot navigation decrypt full originals, and
it never warms the neighbours. Every arrow press pays a full download.

Two independent fixes, both small:

- Call `prefetchDecryptedMedia` for `index ± 1` on index change — the same ten
  lines `MomentViewer` already has.
- Show `thumbs[index]` first and let the original replace it when it lands. Both
  go through the same cache, so this is a `src` swap, not a second pipeline.
  (The lightbox should stay on the original.)

**Effort:** small. **Impact:** high on the memory detail page.

### 5. One Blob per photo instead of two

`decryptBlobOffThread` wraps the plaintext in a Blob (`decryptPool.js:89`).
`decryptToObjectUrl` then reads sixteen bytes back out of it —
`await decrypted.slice(0, 16).arrayBuffer()` — and builds a *second* Blob
whenever the sniffed type differs from the caller's hint. Since every image
caller passes `'image/*'`, which is not a real MIME type, that second Blob is
built essentially every time.

Sniffing the `ArrayBuffer` before it becomes a Blob removes one Blob
construction and one async round trip per photo. Browsers reference rather than
copy the underlying bytes, so this is small — but it is paid on every single
image, and the fix makes the code shorter.

**Effort:** small, contained to `decryptPool.js` + `useDecryptedMedia.js`.

### 6. Budget the network and the CPU separately

`MAX_CONCURRENT_DECRYPTS = 6` gates fetch-and-decrypt as one unit, while
`MAX_WORKERS = 3` gates the decrypt alone. One number is doing two jobs:

- **Throughput:** fetching is network-bound and decrypting is CPU-bound. Holding
  both behind the same six slots means a slow fetch idles a worker and a busy
  worker idles the network.
- **Peak memory:** six in-flight jobs each hold a ciphertext *and* a plaintext.
  For 8 MP originals in a gallery that is comfortably over 100 MB transient — on
  the same phones the 150 MB cache ceiling in `useDecryptedMedia.js` was already
  written to protect.

A higher fetch concurrency with a pool-sized hand-off to the workers fixes both.

**Effort:** small–medium.

### 7. Size the caches to the device

Two fixed ceilings, both generous for a low-end phone:

- `MAX_CACHE_BYTES = 150 * 1024 * 1024` of decrypted blobs (`useDecryptedMedia.js:18`).
  The comment there is already about tab discards on mobile; on a 3 GB Android
  device, 150 MB of object URLs is itself a discard risk.
- `maxEntries: 300` for the ciphertext cache (`sw.js`), shared between originals
  and thumbnails — so scrolling a grid of thumbs evicts the originals the user
  opened earlier, and re-opening a lightbox pays the download again.

Scale the first from `navigator.deviceMemory` / `navigator.storage.estimate()`,
and split the second into two caches with their own budgets.

**Effort:** small.

## What is already right — leave it alone

Worth writing down so it does not get "optimised" later:

- **Text decryption** (`utils/encryption.js`). Ciphertext→plaintext is memoised,
  fields decrypt in parallel, failures are cached too, and the feed deliberately
  skips `contentRich`. Queries are paginated at 50/10.
- **Ciphertext in the service worker, plaintext never.** `sw.js` caches only what
  Cloudinary would serve anyone with the URL. Persisting decrypted photos to disk
  would make reloads instant and is exactly the thing this app must not do.
- **Synchronous cache resolution during render** (`resolveImmediate`). This is
  what stops cached photos flashing a placeholder, and it is why the new spinner
  never appears on a cache hit.
- **Refcounted LRU eviction.** Entries a mounted component is displaying are
  never revoked.

## What the spinner change itself cost

Deliberately nothing measurable:

- No timer, no state, no re-render. The ~320 ms delay before the spinner appears
  is an `animation-delay` on `background-size`, evaluated per element by the
  compositor. A feed mounting forty placeholders adds forty CSS animations, not
  forty React state updates.
- No extra DOM node, and no change to the single-`<img>`-throughout invariant
  that keeps the browser from re-decoding images on every mount.
- The rotation lives inside the SVG, so it composites without touching the main
  thread, and `animate-pulse` — an infinite animation on every placeholder — is
  gone in exchange.

## How to check any of this

There is no synthetic benchmark for the parts that matter; they are network and
device effects. Use the memory feed, cold:

1. DevTools → Network, disable cache, throttle to Fast 4G. Total transferred for
   a first paint of the home feed is the number proposal 1 moves.
2. Performance panel, 4× CPU throttle, record a scroll from the top of the feed.
   Long tasks on the main thread are the number the worker pool already moved —
   check it stays flat.
3. Open a memory detail page and step through a five-photo gallery. Time to first
   paint per arrow press is the number proposals 3 and 4 move.
4. `performance.getEntriesByType('resource')` filtered to `/raw/upload/` gives
   per-photo transfer size and duration without eyeballing the waterfall.

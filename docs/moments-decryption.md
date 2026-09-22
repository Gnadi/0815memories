# Why Moments are slow to appear

A companion to `docs/media-performance.md`, narrowed to one complaint: moments
sometimes take a very long time to show up. "Sometimes" is the important word —
the same screen is fast on one photo and slow on the next, which is what makes
it read as a decryption problem.

It is not a decryption problem. Nothing here is speculative — every claim points
at a file, and the numbers say where they were measured.

## It is not the crypto

AES-256-GCM decrypt, `crypto.subtle` on this container (Node 22, Xeon @ 2.80GHz),
median of 21 runs:

| payload | size | decrypt |
| --- | ---: | ---: |
| 20px inline preview | 0.7 KB | 0.10 ms |
| 256px micro thumb | 15 KB | 0.12 ms |
| 1024px thumb (`thumbs[i]`) | 180 KB | 0.35 ms |
| 12MP original | 4 MB | 1.91 ms |
| original at the upload cap | 10 MB | 4.24 ms |

`MAX_UPLOAD_BYTES` is 10 MB (`src/constants/media.js`), so 4.24 ms is the worst
case a moment can produce. Phone silicon has ARMv8 crypto extensions; call it
15–20 ms there. Downloading those same 10 MB over mobile data takes seconds.

The wait is bytes and placement, not AES. Below, in the order they cost.

## 1. Moments never decrypt `thumbsTiny`, so they have no blur-up

`tinyPreview` is the blur-up placeholder: a ~20px WebP that travels inside the
Firestore document as base64 ciphertext, so it costs no request. It is written
by the shared upload path (`utils/encryptedUpload.js:99-105`) and by the shared
backfill (`utils/thumbnailMigration.js:125-135`) — both of which run for moments
exactly as they do for memories, and both of which **encrypt it**.

Only memories decrypt it again. `decryptMemory` does
(`hooks/useMemories.js:52-54`):

```js
if (Array.isArray(result.thumbsTiny)) {
  result.thumbsTiny = await decryptStringArray(key, result.thumbsTiny)
}
```

`useMoments` (`hooks/useMemories.js:170-232`) and `useAllMoments`
(`hooks/useMemories.js:236-282`) hand the snapshot straight to the view with no
decrypt step at all — they do not even take the key. `utils/nasExport.js:376`
records the assumption in one line: *"moments have no encrypted text fields."*
They have one, and nobody told the read path.

So `tinyPreviewAt(moment, 0)` returns ciphertext, and
`DailyMoments.jsx:48` / `MomentsAllPage.jsx:23` pass it to `EncryptedImage`,
which renders it as a `src` (`EncryptedImage.jsx:29, 50`). Two consequences:

- **No blur-up on any moment surface.** `media-performance.md` §2 calls this
  "the single largest perceived-performance change available here" — moments get
  none of it and wait on a grey shimmer instead. Memories, on the same screen,
  do not.
- **A junk request per card.** A tiny-preview ciphertext is ~996 chars of
  base64 (measured). As an `<img src>` it is a *relative URL*: the browser
  resolves it against the current path and fetches it. `sw.js` registers no
  route for a same-origin path like that, so it goes to the network, and
  `vercel.json`'s catch-all rewrite answers it with `index.html`. On
  `MomentsAllPage`, which loads 200 moments (`useMemories.js:234`), that is up
  to 200 wasted requests competing with the photos.

Confirmed by rendering `DailyMoments` with an undecrypted moment and reading
the emitted `<img src>` back: it is the ciphertext, verbatim.

**Fix:** decrypt `thumbsTiny` in `useMoments`/`useAllMoments`, the way
`decryptMemory` does. Both hooks need the key threaded in — `HomePage.jsx:27`
already has it in scope and passes it to `useMemories` on the line above.

## 2. `MomentViewer` always downloads the full original

`buildMediaItems` (`MomentViewer.jsx:20-27`) builds its list from
`moment.images` and `moment.videos`. It never looks at `moment.thumbs`, and the
two render sites pass no `thumbSrc` and no `tinyPreview`
(`MomentViewer.jsx:324-328` mobile, `548-553` desktop).

So every story slide is a cold, full-resolution download — up to 10 MB — for a
surface that is at most a phone screen, or a 420px card on desktop. Meanwhile
the 1024px thumb of that exact photo was already fetched and decrypted for the
story circle the user just tapped (`DailyMoments.jsx:47`) and is sitting in the
media cache. The viewer asks for a different URL, so none of that is reused.

This is the same problem `MemoryHero` had, and it was fixed there — the hero
shows `thumbs[index]` and leaves the original to the lightbox
(`MemoryHero.jsx:82-89`). `MomentViewer` is the last surface that never got the
treatment.

**Fix:** carry `thumbs[i]` into `buildMediaItems` and pass it as `thumbSrc`,
plus `thumbsTiny[i]` (once §1 lands) as `tinyPreview`. Both go through the same
cache as the original, so this is a `src` swap, not a second pipeline.

## 3. The prefetch is unbounded, and it competes with the photo on screen

`MomentViewer.jsx:146-168` warms **every remaining media item in the current
moment**, plus the next moment's first and the previous moment's last. A moment
with ten photos queues eleven prefetches on the first slide, each a full
original.

The two-lane scheduler (`useDecryptedMedia.js:71-98`) orders the *queue* — it
does not reserve bandwidth. `pump()` fills all six slots
(`useDecryptedMedia.js:63, 78-91`): one for the photo on screen, five for
prefetches. On a phone connection the photo the user is staring at gets roughly
a sixth of the pipe while five 10 MB warm-ups for photos they may never reach
take the rest. Peak memory follows — six in-flight jobs each holding a
ciphertext and a plaintext.

`MemoryHero` prefetches exactly ±1 (`MemoryHero.jsx:43-49`). `MomentViewer`
predates that and was never trimmed.

**Fix:** cap the warm-up at the next item (and the previous, for `goPrev`), and
prefetch the *thumb* rather than the original once §2 lands. Reserving at least
one slot for the foreground lane in `pump()` is the more general version of the
same fix — proposal 6 in `media-performance.md` covers it.

## 4. The story advances whether or not the photo arrived

The auto-advance timer starts on mount and on every index change
(`MomentViewer.jsx:194-204`), 2% per 100 ms, 5 s per item. It has no idea
whether the image is still loading. On a slow connection a slide can run its
full five seconds as a grey rectangle and advance before the photo ever paints —
and then the next slide starts its own cold download.

That is what turns "slow" into "it skipped my photo".

**Fix:** hold the timer until the current item has resolved. `useDecryptedMedia`
already returns `loading`; the viewer needs it lifted out of `EncryptedImage`,
or a small `onLoad` signal.

## Why *sometimes* — the sources of variance

The complaint is that it is uneven. Four things make the same screen fast once
and slow the next time:

1. **Whether the moment has `thumbs` at all.** `thumbAt` returns `''` when the
   array is missing or does not line up, and `EncryptedImage` silently falls
   back to `src` — the full original (`utils/mediaThumbs.js:20-30`). A moment
   uploaded before thumbnails existed renders a **64px story circle from a 10 MB
   file**. The backfill that fixes this is a manual admin button in Settings
   (`OptimizePhotosPanel.jsx`), deliberately not automatic, so a family that
   never pressed it has a feed of originals.
2. **Photos that can never have a thumb.** `createThumbnail` returns `null` when
   `createImageBitmap` cannot decode the source — HEIC on most browsers — and
   the backfill records `''` permanently so the document is never revisited
   (`imageThumbnail.js:69-80`, `thumbnailMigration.js:110-147`). Those moments
   are always slow, forever.
3. **Service-worker cache thrash.** `encrypted-media-cache` is CacheFirst with
   `maxEntries: 300` shared between originals and thumbs (`sw.js:60-74`).
   Scrolling `MomentsAllPage` (200 moments) evicts the originals a user opened
   earlier, so re-opening the same moment pays the download again. Proposal 7 in
   `media-performance.md`.
4. **The fallback path costs double.** Any failure in `decryptToObjectUrl`
   re-fetches with `cache: 'reload'` and decrypts on the main thread
   (`useDecryptedMedia.js:166-175`) — a second full download past every cache.
   A worker that fails to start takes this path per photo:
   `decryptPool.js:45-52` nulls the pool on `onerror` without marking it
   unusable, so the next photo rebuilds three workers and fails again.

## Two smaller things found on the way

- **`MomentViewer` mounts both layouts at once.** The mobile (`md:hidden`) and
  desktop (`hidden md:flex`) trees are both in the DOM; Tailwind only hides one
  with CSS. Every slide therefore creates two `useDecryptedMedia` subscriptions
  and two media elements for the same blob. The fetch is deduped by the cache,
  but the hidden `<video>` still loads and decodes the object URL.
- **The video ref lands on the hidden element.** Both trees pass
  `ref={videoRef}` to `EncryptedVideo`. In React 19 `ref` is an ordinary prop and
  survives `memo`, so both `<video>` elements receive it and the last one
  committed — the desktop one — wins (verified with a render test). On a phone,
  `vid.play()` / `vid.pause()` in `MomentViewer.jsx:182-192` drives the invisible
  video; the visible one only plays because of its `autoPlay` attribute.

## Order to fix

| # | change | effort | what it buys |
| --- | --- | --- | --- |
| 1 | decrypt `thumbsTiny` in the moments hooks | small | blur-up on every moment surface; removes up to 200 junk requests |
| 2 | `thumbSrc` + `tinyPreview` in `MomentViewer` | small | opening a moment reuses bytes already in the cache instead of a 10 MB cold start |
| 3 | cap the prefetch at ±1, warm thumbs not originals | small | the on-screen photo stops competing with ten warm-ups |
| 4 | gate auto-advance on `loading` | small | slides stop skipping past photos that never painted |
| 5 | reserve a foreground slot in `pump()` | small | the general form of 3; helps every surface |
| 6 | split the SW cache budgets (originals / thumbs) | small | re-opening a moment stops re-downloading |

1 and 2 are the two that a user would feel immediately, and neither touches the
decrypt path itself.

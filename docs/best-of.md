# The monthly best-of

On the 1st of every month the family gets a push: *✨ Best of September*.
Tapping it opens a story of last month — Google Photos' "Best of" is the model —
that plays like the moments: tap through, hold to pause, swipe down to close.
It is made of the month's own photos and clips, not one rendered video:

| Slide | What it shows |
| --- | --- |
| `intro` | the month's name among floating photos |
| `count` | how many photos and videos the month had |
| `themes` | the month's most used categories and labels, or places |
| `photo`, `video` | the month's best, in the order they happened |
| `awardIntro`, `award` | "and the biggest smile award goes to…", then the winner |
| `dontForget` | "and don't forget about…", good photos that did not make it |
| `outro` | the end card: watch again, or (admins) put it together again |

The awards: **biggest smile**, **best group photo** (three faces or more),
**place of the month**, **busiest day** and **story of the month** (the
featured memory, or the one with the most photos). At most three per month,
each with its own photo, and only when earned — no award for a smile that is
barely one.

## Where it is made, and why there

Family photos are encrypted, so no server can tell a good one from a blurry
one. The best-of is put together in the browser, in `utils/bestOf.js`:

1. `services/bestOf.js` reads the month's memories and moments (a range on
   `date`, which is never encrypted).
2. `utils/photoAnalysis.js` decrypts up to 36 thumbnails, spread over the
   month, and measures each: sharpness, exposure, colour — and, with
   MediaPipe's face landmarker (`utils/faceDetector.js`), the number of faces
   and the widest smile (the mouth-corner blendshapes).
3. `buildBestOf()` picks the slides. It is deterministic — ties are broken by
   URL — so every device that builds the same month gets the same story.
4. An admin's device saves it to `bestOf/{familyId}_{YYYY-MM}`, the slides
   encrypted as one JSON string like a highlight's.

Nothing about a photo leaves the device; what is kept is in the encrypted
story. The face detector is served from our own origin and asks no one else
for anything: its WebAssembly (~12 MB, ~3.5 MB compressed) is bundled from
`@mediapipe/tasks-vision` — its loader runs in the page, next to the family
key, so it does not come from a CDN — and its model (~3.7 MB, Apache 2.0, see
`THIRD_PARTY_NOTICES.md`) is in `src/assets/models/`. That also keeps the
demo, which must not reach outside its tab, able to show the awards. Both are
loaded only when a best-of is being made, are then in the browser's cache,
and are left out of the service worker's precache. If either fails to load,
the best-of is still made, without the awards that need faces.

## Who makes it, and when

- **An admin's device, in the background**: the moments row on the home page
  looks at last month when it has no saved best-of, and when there is enough
  (six photos and clips), an admin's device makes and saves it a few seconds
  after the page settles (`useCurrentBestOf`).
- **Whoever opens it first**: `/best-of/<month>` plays the saved one, or makes
  it there and then with a progress screen (`useBestOfMonth`). A viewer's device
  cannot save — the rules let only admins write — and does not need to.
- Both share one making per family and month (`makeBestOf`), so the background
  run and a viewer opened during it look at each photo once.
- A saved best-of stays as it is. Photos added to the month later come in when
  an admin chooses *Put it together again* on the last slide.

The moments row shows the circle from the 1st to the end of the month; it
glows until this device has watched it (`localStorage`, per family). Every
saved best-of stays reachable from the row above the moments grid.

## The push

`monthlyBestOfCheck` (`functions/index.js`, logic in `functions/bestOf.js`)
runs on the 1st at 18:00 Europe/Berlin. It counts each family's photos and
clips of last month — memories and moments, one range query each, reading
only `familyId` and the media URLs — and sends the push to families with at
least six (`BEST_OF_MIN_MEDIA`, which `MIN_BEST_OF_MEDIA` in
`utils/bestOf.js` mirrors; a test keeps them equal). The text is the month's
name and nothing else; the link is `/best-of/<YYYY-MM>`.

The evening is deliberate: an admin who opened the app during the day has
usually made the best-of already, and the push opens straight onto it.

## Deploying

- `firestore.rules` and the `bestOf` index (`familyId` ASC, `month` DESC) go
  out with CI on merge. Until the index has built, the row above the moments
  grid stays empty; making and watching do not need it.
- `firebase deploy --only functions` creates the Cloud Scheduler job for
  `monthlyBestOfCheck`. It is the project's third scheduled job, which is the
  number Cloud Scheduler includes for free per billing account.

# The monthly best-of

On the 1st of every month the family gets a push: *✨ Best of September*.
Tapping it opens a story of last month — Google Photos' "Best of" is the model —
that plays like the moments: tap through, hold to pause, swipe down to close,
with music underneath. It is made of the month's own photos and clips, not one
rendered video:

| Slide | What it shows |
| --- | --- |
| `intro` | the month's name among floating photos |
| `count` | how many photos and videos the month had |
| `themes` | the month's most used categories and labels, or places |
| `photo` | a single photo with a camera move: zoom in or out, a pan |
| `collage` | an album, or one day's snapshots, as an animated collage: `duo`, `trio`, `grid`, `polaroids`, `strip` |
| `video` | a clip, muted under the music |
| `awardIntro`, `award` | "and the place of the month is…", then the winner |
| `dontForget` | "and don't forget about…", photos that did not make it |
| `outro` | the end card: watch again, or (admins) put it together again |

The awards are **place of the month** (where the most entries were made),
**busiest day** (four photos and clips or more) and **story of the month**
(the featured memory, or the one with the most photos) — only when earned,
each with its own photo.

## No image analysis

Nothing looks at the photos — not on a server, not in the browser. What makes
a photo or a day stand out is what the family said about it: the memory they
featured, memories over quick moments, albums over single snapshots, the order
the author put the photos in, the place, the day. An earlier version of this
feature found faces and smiles on the device; it was removed, because in an app
whose promise is that the family's pictures are theirs alone, a program judging
faces reads as the opposite of that promise, wherever it runs.

## Where it is made

`utils/bestOf.js` builds the story from the month's memories and moments
(`services/bestOf.js` reads them with a range on `date`, which is never
encrypted). It is pure and deterministic — ties are broken by a hash of the
URL — so every device that builds the same month gets the same story. Not by
the URL itself: it carries the upload time, and with weights as coarse as
these, URL order would give most of the story to the first days of the month.
The moments are spread over the month on purpose: it is cut into as many
stretches of the calendar as the story has room for, and each stretch gives its
best entry before any day gives a second; the clips come from days evenly
spaced through it. A month with one big holiday still shows its other weeks. An admin's device saves
it to `bestOf/{familyId}_{YYYY-MM}`, the slides encrypted as one JSON string
like a highlight's; the rules pin the id and the fields.

- **An admin's device, in the background**: the moments row on the home page
  looks at last month when it has no saved best-of, and when there is enough
  (six photos and clips, at least one of them a photo), an admin's device makes and saves it a few seconds
  after the page settles (`useCurrentBestOf`).
- **Whoever opens it first**: `/best-of/<month>` plays the saved one, or makes
  it there and then (`useBestOfMonth`). A viewer's device cannot save — the
  rules let only admins write — and does not need to.
- Both share one making per family and month (`makeBestOf`).
- A saved best-of stays as it is. Photos added to the month later come in when
  an admin chooses *Put it together again* on the last slide.

The moments row shows the circle from the 1st to the end of the month; it
turns until this device has watched it (`localStorage`, per family). Every
saved best-of stays reachable from the row above the moments grid.

## Motion and music

The slides are React components animated with CSS (`components/bestof/`,
`bestOf.css`): photos drift and zoom, collage tiles slide, pop and drop into
place, and the viewer crossfades from one slide to the next. Everything stops
while the story is held or the page is hidden, and nothing moves for someone
who has asked their system for reduced motion — for them the film strip, the
one layout that needs motion to show all its photos, is a still collage.

The music is synthesized in the browser with the Web Audio API
(`utils/bestOfMusic.js`), in one of three moods, each a short loop:

- *warm*, for spring and autumn: electric-piano arpeggios over a pad, a round
  bass, and the softest kick and shaker;
- *bright*, for summer: a marimba-like motif over a pad, a bass in eighths, a
  kick, a clap on two and four and a shaker;
- *calm*, for winter: long pads, a held bass and a few piano notes, no drums.

There are no audio files: nothing to license, nothing to download, nothing
fetched from anyone. Slides last a whole number of beats of the month's track,
so the story keeps the music's pace — not its beat, though: a slide's clock
starts once its photo is in. When the music stops — the story is closed, it
has reached its end, or the music is turned off — the audio context is
suspended after the fade, so nothing keeps the phone's audio running.

Browsers only start sound after a tap. Opened from the moments row, the tap on
the circle is that tap (`utils/audioContext.js`); opened from a notification,
the story starts silent and the music begins with the first tap, or with the
music button, which also turns it off — remembered on the device. A device
with the music off never starts an audio context at all.

## The push

`monthlyBestOfCheck` (`functions/index.js`, logic in `functions/bestOf.js`)
runs on the 1st at 18:00 Europe/Berlin. It counts each family's photos and
clips of last month — memories and moments, one range query each, reading
only `familyId` and the media URLs — and sends the push to families with at
least six, at least one of them a photo (`familiesWithBestOf`, which
`hasEnoughForBestOf` in `utils/bestOf.js` mirrors; a test keeps them in step).
A month of clips alone gets no push: the app makes no best-of of it. The text is the month's
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

# The monthly best-of

On the 1st of every month the family gets a push: *✨ Best of September*.
Tapping it opens a story of last month — Google Photos' "Best of" is the model —
that plays like the moments: tap through, hold to pause, swipe down to close,
with music underneath. It is made of the month's own photos and clips, not one
rendered video:

| Slide | What it shows |
| --- | --- |
| `intro` | the month's name, in the opening card of the month's look |
| `count` | how many photos and videos the month had |
| `themes` | the month's most used categories and labels, or places |
| `photo` | a single photo with a camera move: zoom in or out, a pan, a diagonal, a tilt |
| `collage` | an album, or one day's snapshots, as an animated collage: `duo`, `trio`, `grid`, `polaroids`, `strip`, `mosaic`, `diagonal`, `pinboard` |
| `video` | a clip, muted under the music |
| `awardIntro`, `award` | "and the place of the month is…", then the winner |
| `calendar` | the month's calendar, the days something was kept on lighting up |
| `rhythm` | when the family shared: mornings, evenings, the weekend… |
| `places` | up to three places of the month, with a photo each |
| `bookends` | the month's first and last photo: "this is how it began… and how it ended" |
| `yearAgo` | a few photos of the same month a year before |
| `dontForget` | "and don't forget about…", photos that did not make it |
| `outro` | the end card: watch again, or (admins) put it together again |

The awards are **place of the month** (where the most entries were made),
**busiest day** (four photos and clips or more), **story of the month** (the
featured memory, or the one with the most photos), **weekend of the month**
(four or more on one Saturday and Sunday), **longest streak** (four days in a
row or more) and **theme of the month** (a category or label on three entries
or more) — only when earned, each with its own photo, three at most. Which
three goes round: each month starts from a different one (`awardOrder`).

## A different best-of every month

So that one month's best-of is not a rerun of the last, each month is told in
one of seven styles, taken in turn (`styleForMonth`, `utils/bestOfStyle.js`):
*polaroid*, *cinema*, *magazine*, *festival*, *diary*, *mosaic* and *minimal*.
Seven does not go into twelve, so the same month a year later has another one.
The style is saved with the story, so the whole family sees the same.

A style decides the composition: its camera moves, the collages its moments
become, its extra cards (`calendar`, `rhythm`, `places`, `bookends`, where the
month has what they need) and the order of the story — the month in numbers
first and the awards between the moments; or straight into the moments with the
awards all together at the end; or the numbers at the end. Its look
(`components/bestof/bestOfLooks.js`) decides the rest: the colours, which the
slides draw with as CSS custom properties; the opening card (floating photos,
a pile of polaroids, a film's title, a magazine cover, a calendar page torn off,
a mosaic of tiles, the name cut out of a photo); the closing card; how one slide
comes in over the last (a fade, a slide, a zoom, a wipe, a blur, a dip through
black); and what it lays over the story — a film's black bars, a diary's paper,
confetti for an award. A best-of saved before there were styles keeps the look
it had.

The look back at the same month a year before reads that month's memories and
moments too, when the best-of is made; a month that cannot be read is a
best-of without that card.

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
place, and one slide comes in over the next as the month's look has it.
Everything stops
while the story is held or the page is hidden, and nothing moves for someone
who has asked their system for reduced motion — for them the film strip, the
one layout that needs motion to show all its photos, is a still collage.

The music is synthesized in the browser with the Web Audio API
(`utils/bestOfMusic.js`): eight tracks, each a short loop, taken in turn month
by month (`trackForMonth`) — eight, so the same month a year later sounds
different too, and at a different pace from the seven styles, so a style comes
back with other music:

- *warm*: electric-piano arpeggios over a pad, a round bass, the softest kick
  and shaker;
- *pop*: a synth arpeggio in sixteenths, an octave bass, four on the floor;
- *calm*: long pads, a held bass and a few piano notes, no drums;
- *folk*: a picked guitar (a Karplus–Strong string) over a quiet pad;
- *lofi*: swung, rolled electric-piano chords and a walking bass;
- *bright*: a marimba-like motif, a bass in eighths, a clap on two and four;
- *waltz*: a music box over a bass and pizzicato, in three;
- *playful*: a glockenspiel tune with pizzicato on the off-beats.

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

# Handwriting font — letters in grandpa's hand

A family member fills in a printed template, you photograph it, and Kaydo turns
it into a real font. From then on a letter to a grandchild, a recipe card or a
scrapbook caption can be set in *their* handwriting. For someone who has
passed away, the same can be pieced together letter by letter from old
postcards.

> **Status:** plan. Nothing is built yet.

## Analysis

**Why it fits Kaydo.** Handwriting is one of the most personal traces a person
leaves, and it disappears quietly: people type everything now. Kaydo already has
letters (kids' journals, Our Year, the Vault), a recipe tree and a scrapbook, so
the font has somewhere meaningful to live from day one. *Oma's recipes, in
Oma's handwriting* is a strong pitch on its own.

**It can run entirely in the browser.** Everything from scanning to the
finished font file runs on the device, so the handwriting never reaches a
server unencrypted. That is important: a person's handwriting is biometric-ish
data, and Kaydo's promise is that the server never sees the content.

**Honest limits**

- A font repeats identical glyphs. Real handwriting doesn't. Without care the
  result looks like a "handwriting font" from a word processor. The fix is to
  capture **2–3 variants per letter** and rotate them with OpenType contextual
  alternates (see below). This is the difference between gimmick and keepsake.
- Joined-up (cursive) writing does not become a good font; letters would have
  to connect at exactly the same height. Print/semi-joined writing works best.
  The template instructions say so.
- **Forgery risk.** A font of a real person's handwriting could be misused, for
  example for a fake signature on a document. Mitigations: no signature glyph,
  text set in the font is always shown with a small "set in Opa's handwriting"
  label in exports, and only admins can create a font.
- **Consent.** For living people the template flow is itself consent. For the
  deceased, the family decides, and the UI makes the creator name visible.

**License note.** The repo is MIT. `potrace` (the classic bitmap tracer) is
GPL-2 and can't be bundled. Use permissively licensed pieces instead:
`opentype.js` (MIT) to write fonts and `imagetracerjs` (Unlicense) or a small
custom marching-squares + curve-fit tracer for vectorising.

## Pipeline

```
 template PDF ─► filled by hand ─► photo / scan
                                        │
   (Web Worker, all local)               ▼
   1. find the 4 corner markers ─► perspective-correct (homography)
   2. cut the grid into cells, read the cell's expected character from the layout
   3. threshold (adaptive, handles uneven light) ─► clean specks
   4. trace bitmap ─► bezier outlines
   5. normalise: baseline from the printed guide line, x-height, side bearings
   6. opentype.js ─► .otf with calt alternates
                                        │
                                        ▼
   preview ─► user fixes bad glyphs (retake a cell / redraw) ─► encrypt ─► upload
```

### The template

- A4, generated with jspdf (already a dependency), available in EN and DE.
- 4 fiducial markers in the corners, and every cell has a light baseline and an
  x-height guide in a colour the threshold step drops.
- Character set v1: `a–z A–Z 0–9 ä ö ü Ä Ö Ü ß . , ; : ! ? ' " - ( ) & € @ /`.
  Lowercase letters twice (two variants), the six most frequent letters
  (e, n, i, r, s, a) three times.
- One extra box: *"write a short sentence"*. It is not used for the font. It is
  kept as a sample to compare the font against, and it doubles as a memory.

### Two other ways to capture

- **Draw directly** on a tablet with a stylus in the same grid (Pointer Events,
  pressure → stroke width). No printing or scanning, and the cleanest result.
  Great for grandparents with an iPad.
- **Harvest from old letters** (phase 3, the emotional core): upload a scan of a
  postcard, draw a box around a letter, type which letter it is. Kaydo shows
  which letters are still missing. It is slow, manual work, and that is fine: it
  is the only way to rescue the handwriting of someone who is gone.

### Making it look human

- **Variants:** `a`, `a.alt1`, `a.alt2`. A `calt` feature cycles variants based
  on the previous glyph, so "Anna" doesn't repeat the same `n`. This works in
  every modern browser and in canvas text.
- **Jitter:** a tiny random baseline shift and rotation per variant, baked into
  the outlines at build time (the font itself stays static).
- **Pen:** keep the ink texture by tracing at a high resolution and not
  over-smoothing curves.

## Data model

```
handwritings/{id}               // rules: read isFamilyMember, write isFamilyAdmin
  familyId
  personName   (encrypted)      // "Opa Franz"
  fontUrl      (encrypted blob, ~50–200 KB .otf via encryptedUpload)
  sampleUrl    (encrypted)      // the free sentence, as image
  glyphCount, missing: [...]    // for the "still missing" view
  source: 'template' | 'drawn' | 'harvested'
  createdAt, createdBy
```

Loading it: decrypt → `new FontFace('kaydo-hw-<id>', buffer)` →
`document.fonts.add()`. It is held in memory only and never written unencrypted
to the Cache API or IndexedDB.

## Where the font shows up

| Place | How |
| --- | --- |
| Letters to kids (journal), Our Year letter, Vault messages | a "write in …'s handwriting" toggle; stored as a `fontId` next to the text |
| Recipes | recipe card view in the author's handwriting |
| Scrapbook / collage text | an extra entry in the font list of `TextPanel` / collage text (`FONT_STACKS`) |
| PDF export (scrapbook) | jspdf `addFileToVFS` + `addFont` with the decrypted TTF/OTF |
| NAS export (`src/utils/nasExport.js`) | include the `.otf` and a README, so the font survives without Kaydo |

Exports are images and PDFs, so the protection against misuse is in the font
itself: it has no signature glyph, and exports carry the "set in …'s
handwriting" label.

## Implementation phases

| Phase | Scope | Size |
| --- | --- | --- |
| 1 | Template PDF, image upload, marker detection + warp, cell cut, threshold, trace, opentype.js build, preview page. One variant per glyph. | L |
| 2 | Glyph editor (retake/redraw a cell), variants + `calt`, storage/encryption, use in scrapbook and letters | M |
| 3 | Stylus drawing mode | S–M |
| 4 | Harvest from old letters | M |
| 5 | PDF + NAS export integration, recipe card view | S |

**Testing:** unit tests for the homography and cell slicing with a synthetic
rendered template (render the template with known glyphs → run the pipeline →
compare outlines), plus a rules test for `handwritings`.

## Open questions

1. Should viewers (not only admins) be able to *use* a font when writing? Today
   viewers mostly read, so admins-only is the natural start.
2. German Kurrent/Sütterlin in old letters: harvested glyphs work, but it's worth
   checking whether anyone in the family can still read them.
3. Should a font be tied to one person in a future family-tree feature? The data
   model already carries `personName`, so it can be linked later.

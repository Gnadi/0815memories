# QR / NFC tags — memories you can touch

A small sticker on the back of a framed photo, under grandpa's watch or inside
the family cookbook. Point a phone at it (or tap it) and the memory behind the
object opens: the story, the photos, grandma telling it in her own voice.

> **Status:** plan. Nothing is built yet.

## Analysis

**Why it fits Kaydo.** Everything in Kaydo lives behind a screen today. Tags
connect the app to the objects the memories are *about*, and they keep working
for decades: a printed QR code needs no battery, no app and no account on a
third-party service. It is also the one feature that makes Kaydo visible in the
house without being a screen.

**The hard part is not the QR code.** Generating one is ten lines. The real
question is: *a URL printed on paper is permanent and can be photographed by
anyone.* What happens when a stranger scans it? Kaydo encrypts everything with
the family key, so the answer decides the whole design.

| Mode | Who can open it | How | Good for |
| --- | --- | --- | --- |
| **Family tag** (default) | only signed-in family members | URL points to the family's subdomain; normal login, then redirect to the memory | photos on the wall, heirlooms at home |
| **Open tag** (opt-in) | anyone holding the object | a per-tag key lives in the URL **fragment** (`#k=…`), which browsers never send to a server; the content is re-encrypted with that key | a print given to a friend, a card at a funeral, a gift to a grandchild without an account |

Open tags are a deliberate, visible trade: the sticker *is* the key. The UI must
say that in plain words, show exactly what is shared, and let an admin revoke
the tag at any time.

**Risks**

- A stolen/lost object with an open tag leaks what that tag shares. Mitigation:
  open tags share one memory, never a collection; revocation is one click.
- iOS cannot *write* NFC from the web (Web NFC is Chrome-on-Android only).
  Reading works everywhere, because a tag just holds a URL.
- Deep links today lose their target: `ProtectedRoute` sends unauthenticated
  users to `/` (`src/components/layout/ProtectedRoute.jsx`), so after login the
  person lands on the home feed, not on the scanned memory. That has to be fixed
  first — it is useful beyond this feature (push notifications, shared links).

## How it works

```
 sticker ──► https://<slug>.kaydo.app/t/<tagId>[#k=<tagKey>]
                         │
                         ▼
               TagResolvePage (/t/:tagId)
               ├─ family tag → signed in? ─ no → login → back to /t/:tagId
               │                           └ yes → read tags/{tagId} → navigate to target
               └─ open tag  → read openTags/{tagId} (no auth), decrypt with #k → TagPlayer
```

A tag is an **indirection**, not a direct link to `memory/:id`. The printed
URL never changes, but the tag can be re-pointed (the photo got a better
story), renamed or revoked without reprinting anything.

### Tag ids

- Random, unguessable, URL-safe: 128 bits → 22 base64url characters.
  Enumerating them is not practical, and Firestore rules allow `get`, never
  `list`, on open tags.
- The QR stays small enough for a 2 cm sticker at error-correction level **M**
  (level **H** if a logo sits in the centre).

### Open-tag cryptography

1. Generate a fresh AES-256-GCM key per tag (`generateEncryptionKey` in
   `src/utils/encryption.js` already does this).
2. Decrypt the chosen memory with the family key, re-encrypt the selected fields
   and media with the tag key, and upload the media again via the existing
   encrypted-upload path (`src/utils/encryptedUpload.js`). The family key never
   leaves the family.
3. The tag key is exported as base64url and put into the URL fragment only.
4. Revoke = delete `openTags/{tagId}` and the tag's media copies. The sticker
   then shows a friendly "this tag is no longer active" page.

This duplicates media, which is fine for a single memory (a few photos and one
voice memo) and is exactly why open tags are limited to one memory.

## Data model

```
tags/{tagId}                      // family tags — rules: isFamilyMember
  familyId
  target: { type: 'memory' | 'recipe' | 'blackbox' | 'journal' | 'scrapbook', id }
  label            (encrypted)   // "Opa's watch"
  mode: 'family' | 'open'
  medium: 'qr' | 'nfc' | 'both'
  createdAt, createdBy, revokedAt?

openTags/{tagId}                  // only for mode 'open' — rules: get: true, list: false,
  payload          (encrypted with tag key)   // title, story, quote, author, date
  media: [{ url, kind, thumb }]  (encrypted with tag key)
  createdAt
```

Rules tests go into a new `src/__tests__/tagRules.test.js` and get added to
`npm run test:rules`:

- a viewer of another family can't read `tags/*`
- nobody can `list` `openTags`
- only a family admin can create or delete either

## UI

- **"Create tag" action** on memory detail, recipe journey, Vault item and
  scrapbook pages (admins only).
- **Tag sheet dialog:** choose mode, preview what the scanner will see, pick an
  output:
  - *Sticker sheet PDF:* common round/square label layouts, with jspdf (already
    a dependency) and a QR library such as `qrcode` (MIT)
  - *Photo card PDF:* photo + short caption + QR, to print and put behind a
    frame or into an album
  - *PNG* for your own printing
  - *Write to NFC* (Chrome Android, `NDEFReader.write({ records: [{ recordType: 'url', data }] })`);
    everywhere else it shows the URL and a two-line hint for apps like NFC Tools
- **Tag player** (`/t/:tagId`): full-bleed photo, title, and a large "▶ Listen"
  button. Browsers block autoplaying audio until the user taps, so it's one
  deliberate tap. Designed for grandparents: large text, no navigation chrome.
- **Settings → Tags:** a list of all tags with label, target, mode and "revoke".

## Implementation phases

| Phase | Scope | Size |
| --- | --- | --- |
| 0 | Return-to-target after login (`?next=` through `ProtectedRoute` → login → redirect). Validate `next` is a same-origin path. | S |
| 1 | Family tags: `tags` collection + rules + tests, `/t/:tagId` resolver, QR PNG + sticker-sheet PDF | M |
| 2 | NFC writing (feature-detected), tag list in Settings, re-pointing a tag | S |
| 3 | Open tags: per-tag key, re-encryption + media copy, public tag player, revocation, rules tests | M–L |
| 4 | Nice extras: photo-card templates, a "scan count" shown only to admins (optional, no third-party analytics) | S |

## Open questions

1. Do open tags belong in the first release, or should we ship family tags
   first and see if people ask for them? (Recommendation: family tags first.)
2. Should the tag URL use the family subdomain (nice, but breaks if the slug
   changes) or a neutral `kaydo.app/t/…`? The neutral one survives renames, but
   a signed-out scanner needs to know which family's login to show, so it needs
   a small public `tagId → familyId` lookup (like `familyPublic`). That lookup
   reveals which family a sticker belongs to, which is harmless in most homes but
   worth deciding on purpose.
3. Do we sell/ship physical NFC stickers ourselves later? Out of scope here, but
   the data model doesn't block it.

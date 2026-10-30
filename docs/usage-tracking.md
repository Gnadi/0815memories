# Usage tracking

During the friends-and-family phase Kaydo records, in its own database, which
areas are used and where people get stuck. Nobody else is involved: no
analytics vendor, no cookies, nothing stored on the device. (Vercel Web
Analytics and Speed Insights, which count page views, are separate and were
there before.)

## What is recorded

A document in `usageEvents` holds:

| field | |
| --- | --- |
| `familyId`, `role` | who, as far as the family and `admin` / `viewer` |
| `name` | one of the events below |
| `props` | at most three labels: `feature`, `kind`, `reason`, `area`, `result`, `tries` |
| `lang`, `standalone` | language, and whether the app runs installed |
| `session` | random, per page load, held in memory |
| `createdAt`, `expireAt` | server time, and when the TTL policy deletes it |

It never holds text, titles, names, file names, ids of content, keys or a user
id. A label has to be a short slug (`^[a-z0-9_-]{1,40}$`), so a sentence or a
title does not fit; `firestore.rules` pins the shape a second time.

| event | when | labels |
| --- | --- | --- |
| `session_started` | once per page load, when the family is known | |
| `family_created` | an admin created a family | |
| `invite_created` | an admin invite link was made | |
| `viewer_password_set` | the shared viewer password was set | |
| `viewer_login_succeeded` | a viewer got in | `tries` if there were wrong guesses first |
| `item_created` | memory, moment, journal entry, child, recipe, scrapbook, collage, highlight, vault capsule, Our Year chapter | `kind` |
| `feature_opened` | a page of a feature was opened | `feature` |
| `upload_rejected` | a file was refused before upload | `kind`, `reason` |
| `upload_failed` | an upload failed | `kind` |
| `error_shown` | the route error screen, or the missing-key screen | `area`, `reason` |
| `push_permission` | the browser's answer to the notification prompt | `result` |
| `pwa_installed` | the app was installed | |
| `feedback_sent` | the feedback form was sent | |

A failed viewer login cannot be recorded when it happens, because nobody is
signed in yet; the next success carries the number of tries.

Nothing is recorded in the demo, for a signed-out visitor, or on a device
where the person switched "Usage statistics" off in the settings.

## Adding an event

Add it in three places, together: `USAGE_EVENTS` in
`src/constants/usageEvents.js`, the list in `usageEventShapeOk()` in
`firestore.rules` (a test compares the two lists), and the call site:
`trackEvent('name', { label: 'value' })` from `src/services/usage.js`. Record
things in the service that does the write where there is one, so every caller
is covered. Then update the table above and the privacy policy if what is
recorded changes in kind.

## One-time setup: delete after 90 days

Events carry `expireAt`; Firestore deletes them once a TTL policy exists for
that field. It is a setting of the project, not of the code, so it is made
once per project:

```
gcloud firestore fields ttls update expireAt --collection-group=usageEvents --enable-ttl --project <project-id>
```

## Reading it

The collection is unreadable from the client. Read it server-side:

```
GOOGLE_CLOUD_PROJECT=<project-id> node scripts/usage-report.mjs --days 30
```

It needs the Admin SDK's credentials for that project, so run it yourself.
It prints, over all families and then per family, how far each got
(family created → first content → viewer password → viewer signed in →
returned on a second day), where it stopped, which features it opened and
which of them never produced anything, and the problems that came up.

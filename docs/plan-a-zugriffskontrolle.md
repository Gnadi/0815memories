# Access control — closing the public read

Kaydo encrypted everything and then published the key. This is the change that
fixed it, and the reasoning behind each part, so the next person to touch these
rules knows which lines are load-bearing.

Nothing here is speculative — every claim points at a file.

## What was wrong

`firestore.rules` had `allow read: if true` on `families/{familyId}`, and that
document carries `encryptionKeyJwk`. The login page handed out the family id
needed to fetch it: `LoginPage.jsx` resolves a family by slug on mount, before
anyone types a password, and the resolver returned the whole document.

`memories`, `moments` and `albums` were public too, and they carry the Cloudinary
URLs in clear text — the URLs are what makes the ciphertext findable, so they
cannot be encrypted themselves. Uploads are plain `raw` resources with no
`access_control`, so those URLs are publicly fetchable.

Four steps, all unauthenticated, and you had someone's photos: list the
families, take the key, list the memories, fetch and decrypt. The cryptography
was never the weak part.

### Why it was built that way

Not carelessness — a consequence. `loginAsViewer` used to compare the shared
password with bcrypt **in the browser** and set a flag in `localStorage`. There
was no `signInAnonymously`, no custom token, nothing. So for Firestore a
signed-in viewer was indistinguishable from a stranger: `request.auth` was
`null` either way.

Viewers have to read the feed and decrypt photos. With no identity to check, the
only rule that let them in was one that let everyone in. Every public read in
the file followed from that one missing piece.

## The fix

Give viewers an identity Firestore can verify.

1. `viewerLogin` (callable, `europe-west3`) checks the shared password
   server-side against a hash no client can read, and returns a custom token
   carrying `{ familyId, role: 'viewer' }`.
2. The client exchanges it via `signInWithCustomToken`.
3. `firestore.rules` reads `request.auth.token.familyId` and
   `request.auth.token.role`.

Admins get the same shape of claim, so the rules have one concept of membership
rather than two.

### Where each piece lives

| Concern | Where |
| --- | --- |
| Password check, token minting | `functions/index.js` → `viewerLogin` |
| Password changes | `functions/index.js` → `setSharedPassword` |
| Public login-page fields | `functions/index.js` → `mirrorFamilyPublic` |
| Admin claims | `functions/index.js` → `syncAdminClaims` |
| Role → privilege | `src/context/AuthContext.jsx` |
| Who may read what | `firestore.rules` |
| Proof it holds | `src/__tests__/authRules.test.js` |
| One-time data move | `scripts/migrate-access-control.mjs` |

### The public mirror

The login page needs seven fields before anyone authenticates — counted from
`toResolvedFamily` in `LoginPage.jsx`: `familyName`, `loginHeaderImage`,
`loginPageMode`, `loginTheme`, `loginCustomHtml`, `loginCustomCss`, `loginCard`,
plus `familySlug` to find the family at all.

Those eight live in `familyPublic/{familyId}`, written **only** by the
`mirrorFamilyPublic` trigger from `PUBLIC_FAMILY_FIELDS`. The allowlist is on
the server on purpose: the public surface is an explicit list rather than
"everything except what we remembered to strip". A field added to `families`
later cannot become public by default.

That failure mode is not hypothetical here. `encryptFields` skips a non-string
silently, which is how the Black Box shipped plaintext for the life of the
feature (commit `bc4b605`). Same shape of bug, so same shape of defence.

`familySlug.js`, `LoginPage.jsx` and `InviteRedeemPage.jsx` all read the mirror
now. The invite page matters: it shows the family name to someone who has no
account yet.

### The role claim, and the trap in it

`AuthContext` used to derive privilege as:

```js
const isAdmin = !!user
```

Correct while viewers had no Firebase session. Once they sign in with a custom
token they have a `user` object too — and that line would have made **every
viewer an administrator**, straight through `ProtectedRoute`'s `adminOnly` gate.

It now reads the role off the ID token:

```js
const isViewer = role === 'viewer'
const isAdmin = !!user && role === 'admin'
```

`'viewer'` is only ever minted by `viewerLogin`, so anything else holding a
session is an admin — including an admin whose claim the sync trigger has not
written yet. `src/__tests__/authRole.test.jsx` exists to keep that line from
quietly reverting; it fails if you put `!!user` back.

### Claims, not document reads

`isFamilyMember` checks the viewer claim **first**:

```
function isFamilyMember(familyId) {
  return isFamilyViewer(familyId) || isFamilyAdmin(familyId);
}
```

Viewer membership is pure token arithmetic, so a viewer never falls through to
the `get()` inside `isAdminByDocument`. On a feed listing fifty documents that is
the difference between no document reads and one per evaluation, and it keeps
clear of the rules engine's per-request access limit.

`isAdminByDocument` is the transitional half of `isFamilyAdmin`: an admin who
signed up before the migration, or in the seconds before the claim trigger
fires, is in `adminUids` with no claim yet. Retire that branch once every admin
carries a claim — it is the only thing left that costs a read.

## Two things found along the way

Neither was part of the original plan; both were sitting in the same rules.

**Invites could be enumerated.** `families/{id}/invites` had `allow read: if
true`, and in Firestore `read` covers `list`. The document id *is* the
credential, so an enumerable list was a list of usable admin invites — and the
redemption path (`admins/{uid}` → Path C on the family document) turns one into
admin status. Now: `allow get: if true` (holding the link still works),
`allow list: if isFamilyAdmin(familyId)`.

**`notificationsQueue` said `request.auth != null`.** That meant "is an admin"
only while viewers were unauthenticated. It now names the family:
`isFamilyAdmin(request.resource.data.familyId)`. Otherwise giving viewers a
session would have let them push a notification to everyone in the family.

The same reasoning applies to the other standalone `request.auth != null`
checks — family creation, `admins/{uid}` creation, invite redemption — which now
carry `tokenRole() != 'viewer'`.

## Rate limiting

The password check moved from the browser to a clean API endpoint, which makes
it a better target as well as a safer one. `viewerLogin` therefore throttles
before it does any work — the bcrypt comparison is deliberately expensive, so an
attacker must not be able to make us run it.

Counters live in `rateLimits/{key}`, keyed by family **and** by caller IP:
5 failures in 15 minutes, then a block doubling from 30s to a 1h cap. Written by
the Admin SDK; `allow read, write: if false` for everyone else.

Every failure answers identically. "No such family" and "wrong password" must
not be distinguishable, or the endpoint becomes a way to enumerate families.

## Deploying it

Order matters. The rules go last, because they assume everything else is already
in place. Reversed, the app locks itself out.

1. `npm run test:rules` — green locally, nothing deployed.
2. `firebase deploy --only functions` — triggers and callables first, so the
   claim and mirror machinery is running before anything depends on it.
3. `node scripts/migrate-access-control.mjs --dry-run`, read it, then again
   without the flag. Creates the mirrors, moves the password hashes, sets admin
   claims. Idempotent.
4. Deploy the client. It already uses tokens; the old rules still permit that.
5. `firebase deploy --only firestore:rules` — **the cut**. Public reading stops
   here.
6. Verify. Without a token, expect `403 PERMISSION_DENIED`:

   ```
   curl "https://firestore.googleapis.com/v1/projects/<PROJECT_ID>/databases/(default)/documents/families/<FAMILY_ID>"
   curl "https://firestore.googleapis.com/v1/projects/<PROJECT_ID>/databases/(default)/documents/memories"
   ```

Steps 2–4 are additive and do not break the old app. Step 5 is the only one that
does, and the only one that reverts in seconds — keep the previous
`firestore.rules` and redeploy it if something is wrong.

### It is not a seamless cutover

Every existing session breaks at step 5. Viewers re-enter the shared password;
admins need a token carrying a claim, which a reload provides. That is the point
of the change, but it needs saying out loud beforehand.

Kaydo is an installed PWA, so some devices hold an older build in the service
worker cache and will fail quietly against the new rules. Ship the client (step
4) far enough ahead that installed devices have taken the update.

## Still open

**App Check is written but not enforced.** `viewerLogin` and `setSharedPassword`
read `ENFORCE_APP_CHECK`, defaulting to off, because enforcing it needs a
reCAPTCHA key wired into the client first. To finish: register a reCAPTCHA v3
site key, initialise App Check in `src/config/firebase.js`, then set
`ENFORCE_APP_CHECK=true` on the functions. The rate limiter does not depend on
it.

**Cloudinary still serves media publicly.** After this change the ciphertext is
useless without the key, so this is the next layer rather than a hole: it would
deny an attacker the metadata — which files exist, how large, uploaded when.
The shape: upload `raw` resources as `type: 'authenticated'` under a
`kaydo/encrypted/{familyId}/` prefix, add an endpoint that verifies the Firebase
ID token and signs a short-lived URL, resolve through it in
`useDecryptedMedia` (the existing `inflight` map is the right place to cache
that), and migrate existing assets with Cloudinary's `rename`. It touches the
media hot path, so it belongs after the above is live and stable.

**The `isAdminByDocument` fallback** in `firestore.rules`, and the
`resolveFamilyId` fallback in `AuthContext`, can both go once every admin has a
claim.

**`albums` is gated but unreferenced** — no client code touches the collection.
Worth checking whether it still holds data, and deleting it if not.

## What this does not fix

The encryption key is still stored server-side, in `families/{id}`. Anyone with
console access can read it. Kaydo is **not** zero-knowledge, and this change
does not make it so — it makes the key private to the family instead of public
to the internet, which is a different and smaller claim.

Deriving the key from the shared password (PBKDF2/Argon2) would close that, at
the price of a forgotten password meaning permanent data loss, and of needing a
second wrapped copy for admins, who authenticate with email rather than the
family password.

A shared password also remains a shared password: whoever passes it on passes on
the access. Per-person viewer accounts would be the next step, and with the token
machinery from this change they are now a small one.

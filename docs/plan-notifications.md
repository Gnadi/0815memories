# Notifications — why nothing arrives, and how to build it properly

The code contains a complete push stack: service worker, token handling,
prompt, queue collection, Cloud Function. Even so, probably nobody has ever
received a push notification from Kaydo. This document says why — every point
refers to a file — and what the stack should look like on the Blaze plan.

> **Status:** live. Rules, client and functions are deployed, and a test
> notification arrived on a real device. The test button that checked this has
> been removed again since — see [After the rollout](#after-the-rollout).

## Current state

| Part | Where | State |
| --- | --- | --- |
| Permission + fetching the token | `src/utils/notifications.js` → `requestAndSaveFCMToken` | broken (finding 1) |
| Token storage | collection `fcmTokens`, rules `firestore.rules:580` | empty |
| Prompt / foreground toast | `src/components/NotificationPrompt.jsx`, `src/App.jsx` → `AppNotifications` | ok |
| Display in the background | `src/sw.js` → `push` / `notificationclick` | ok |
| Trigger "new memory/moment" | `src/hooks/useMemories.js:103,213` → writes to `notificationsQueue` | questionable concept (finding 5) |
| Trigger "3 years ago" | `src/hooks/useAnniversaryReminder.js` | stopgap from the Spark days |
| Sending | `functions/index.js` → `dispatchPushNotifications` | gen 1, `us-central1` (findings 2/3) |

## The findings

### 1. Token registration fails on our own rules

`requestAndSaveFCMToken` looks for an existing token document before it
writes:

```js
const q = query(collection(db, 'fcmTokens'), where('token', '==', token))
const existing = await getDocs(q)      // ← permission-denied
```

`firestore.rules:598` says `allow read: if false` for the same collection. The
query throws, the function aborts before it writes, and the caller in
`NotificationPrompt.handleEnable` catches nothing (`try/finally`, no `catch`)
— the prompt closes as if all were well.

Result: `fcmTokens` stays empty. Even a perfectly deployed function would find
`tokens.length === 0` and do nothing. **This is the actual reason notifications
don't work** — everything else comes after it.

### 2. The dispatcher lives in the US and stays there

`setGlobalOptions({ region: 'europe-west3' })` in `functions/index.js` only
affects v2 functions, and it also comes *after* the definition of
`dispatchPushNotifications`. The v1 trigger
(`firestore.document(...).onCreate(...)`) sets no region and so runs in
`us-central1`.

A redeploy cannot change that: an existing function cannot switch regions; it
has to be deleted and created again
(`firebase functions:delete dispatchPushNotifications`). Forget that, and you
end up with two dispatchers and duplicate pushes.

### 3. Gen 1 was a Spark workaround that was never right

The comment in `.env.example` ("Uses Cloud Functions gen 1, which works on the
free Firebase Spark plan") has been wrong since the move to Artifact Registry
and Cloud Build — gen 1 needs Blaze too. That is exactly why the README says
"push is optional". With Blaze, the reason for v1 is gone entirely, and the v2
API (`onDocumentCreated`) is the one the rest of the file already uses.

### 4. The stale-token cleanup deletes valid devices

```js
const staleTokenDocs = tokenDocs.filter((_, i) => results[i].status === 'rejected')
await Promise.allSettled(staleTokenDocs.map((d) => d.ref.delete()))
```

Every failure deletes the token — including a brief `UNAVAILABLE`, a quota
error or a network timeout. A single FCM hiccup unsubscribes a healthy phone
for good, and nobody notices, because the user granted the permission long
ago. Deleting is only right for `messaging/registration-token-not-registered`
and `messaging/invalid-argument`.

### 5. The plaintext title in the queue document undoes the encryption

`useMemories.js:103` writes:

```js
body: memory.title ? `"${memory.title}" was just shared.` : ...
```

The title is encrypted in `memories` — and ends up here unencrypted in
Firestore, and then with Google in the FCM payload. The same goes for
`moment.caption`. All the effort of "Stop publishing the key that encrypts
everything" is void for the content of the notification.

On top of that, the path "the client writes arbitrary text to
`notificationsQueue`" is a push channel whose content nobody checks. The rules
only validate that the sender is an admin of the family, not *what* they send
to every device.

### 6. Side findings

- **The texts are English** (`'New memory added'`), although the app has i18n.
  Today the server doesn't know which language a device speaks.
- **iOS** delivers web push only from 16.4, and **only** when the PWA is
  installed on the home screen. In a Safari tab the prompt appears and the
  subscription fails. That explains most of the "nothing arrives for me" cases
  that remain after the fix.
- **`VITE_FIREBASE_VAPID_KEY`** must be set in Vercel; otherwise
  `requestAndSaveFCMToken` silently returns `null` and the prompt never shows
  (`NotificationPrompt.jsx:25`).
- **The anniversary check** (`useAnniversaryReminder`) only runs when an admin
  opens the app. That was the Spark stopgap after the Vercel cron went away.

## Target design

```
Memory/moment is created                 Cloud Scheduler (daily 08:00 Europe/Berlin)
        │                                          │
        ▼                                          ▼
onDocumentCreated (europe-west3)          onSchedule (europe-west3)
        │                                          │
        └──────────────► sendToFamily() ◄──────────┘
                              │
                   fcmTokens (by familyId + language)
                              │
                     sendEachForMulticast
                              │
                        sw.js: push → showNotification
```

Three changes from today: the text is written **on the server** (no plaintext
from encrypted fields, no push the client can steer), `notificationsQueue` goes
away, and everything lives in `europe-west3`.

## Implementation

### Step 0 — Check the prerequisites (15 min, no code)

1. Confirm the Firestore location:
   `gcloud firestore databases describe --database='(default)'`. With the
   regional location `europe-west3` (which is to be expected, because
   `mirrorFamilyPublic`/`syncAdminClaims` are deployed there as v2 Firestore
   triggers), function and database match. If it were the multi-region `eur3`,
   the Firestore triggers would have to go to `europe-west4` — to be settled
   before step 2.
2. Create or check the VAPID key in the Firebase console (Cloud Messaging → Web
   Push certificates) and store it as `VITE_FIREBASE_VAPID_KEY` in Vercel (all
   three environments).
3. `firebase functions:list` — is `dispatchPushNotifications` really in
   `us-central1`, and do the four v2 functions run in `europe-west3`?

### Step 1 — Fix the token registration (blocker)

`src/utils/notifications.js`: the query goes, a deterministic document id comes
in. The SHA-256 of the token is the id, so that no read access is needed and a
device has exactly one document.

```js
const idBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
const tokenId = [...new Uint8Array(idBuf)].map((b) => b.toString(16).padStart(2, '0')).join('')

await setDoc(doc(db, 'fcmTokens', tokenId), {
  familyId,
  token,
  uid: auth?.currentUser?.uid || null,
  lang: i18n.resolvedLanguage || 'de',
  updatedAt: serverTimestamp(),
}, { merge: true })
```

In addition:

- Stop swallowing errors: `handleEnable` gets a `catch` that logs in DEV and
  shows the user a hint when it fails.
- On sign-out or a change of family, call `deleteToken()` and delete the
  document, instead of pointing it at a new `familyId`.
- iOS: show the prompt only when `window.matchMedia('(display-mode: standalone)')`
  or `navigator.standalone` holds — otherwise show the hint "Add to the home
  screen to allow notifications" instead.

`firestore.rules` to match (since Plan A, viewers have a real identity, so the
rule may forbid anonymous writes):

```
match /fcmTokens/{tokenId} {
  allow create, update: if request.resource.data.familyId is string
                        && isFamilyMember(request.resource.data.familyId)
                        && request.resource.data.token is string
                        && request.resource.data.token.size() > 0
                        && request.resource.data.token.size() < 4096;
  allow delete: if isFamilyMember(resource.data.familyId);
  allow read:   if false;
}
```

Test in `src/__tests__/authRules.test.js`: another family may not write, the
own device may write and delete, nobody may read.

### Step 2 — Dispatcher to europe-west3, on v2

1. `firebase functions:delete dispatchPushNotifications --region us-central1`
   **first** — otherwise the old function keeps running.
2. In `functions/index.js`: remove the `firebase-functions/v1` import, move
   `setGlobalOptions` to the top, before all definitions.
3. One shared sending function that every trigger uses:

```js
async function sendToFamily(familyId, build, { excludeUid } = {}) {
  const snap = await getFirestore().collection('fcmTokens')
                  .where('familyId', '==', familyId).get()
  const docs = snap.docs.filter((d) => !excludeUid || d.data().uid !== excludeUid)
  if (docs.length === 0) return

  // Group by language — the text is written here, not in the client.
  const byLang = new Map()
  for (const d of docs) {
    const lang = d.data().lang === 'en' ? 'en' : 'de'
    if (!byLang.has(lang)) byLang.set(lang, [])
    byLang.get(lang).push(d)
  }

  for (const [lang, group] of byLang) {
    const { title, body, url } = build(lang)
    const res = await getMessaging().sendEachForMulticast({
      tokens: group.map((d) => d.data().token),
      data: { title, body, url },
      webpush: { headers: { Urgency: 'normal', TTL: '86400' } },
    })
    await Promise.allSettled(res.responses.map((r, i) => {
      const code = r.error?.code
      if (code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-argument') return group[i].ref.delete()
      return null                       // transient errors: keep the token
    }))
    console.log(`[push] family=${familyId} lang=${lang} ok=${res.successCount} fail=${res.failureCount}`)
  }
}
```

`sendEachForMulticast` turns N single requests into one batch (up to 500
tokens) and returns an error code per token — both are needed for the precise
cleanup from finding 4.

### Step 3 — Move the triggers to the server

`notificationsQueue` goes away: the collection, the two `addDoc` calls in
`useMemories.js` and the rules block `firestore.rules:600`.

Instead, two triggers that read from where the data is created anyway:

```js
export const notifyOnMemory = onDocumentCreated('memories/{memoryId}', (event) => {
  const d = event.data?.data()
  if (!d?.familyId) return
  return sendToFamily(d.familyId, (lang) => ({
    title: lang === 'en' ? '📷 New memory' : '📷 Neue Erinnerung',
    body:  lang === 'en' ? 'Someone just shared a new memory.'
                         : 'Es wurde gerade eine neue Erinnerung geteilt.',
    url: `/memory/${event.params.memoryId}`,
  }), { excludeUid: d.createdByUid })
})
```

and likewise `notifyOnMoment` on `moments/{momentId}` with `url: '/'`.

No content in the text — the server cannot and should not know it. Whoever
wants to see more taps the notification and gets the decrypted title in the
app. The foreground toast (`AppNotifications`), on the other hand, may show the
real title: the key is available there.

So that authors don't notify themselves, `useMemoryWriter.addMemory` will write
`createdByUid: auth.currentUser.uid` (a plaintext uid, harmless;
`memoryContentOk()` has no field whitelist, so the rules need no change). For
viewers the suppression does not apply — they share the identity
`viewer:${familyId}` — but viewers don't create anything anyway.

### Step 4 — The anniversary as a real scheduler

With Blaze there is Cloud Scheduler. The client lock (`useAnniversaryReminder`,
`utils/anniversaryClient.js`, the field `lastAnniversaryCheckDate` on the
family document) goes away:

```js
export const dailyAnniversaryCheck = onSchedule(
  { schedule: '0 8 * * *', timeZone: 'Europe/Berlin' },
  async () => {
    const families = await getFirestore().collection('families').select().get()
    for (const fam of families.docs) {
      const hit = await countAnniversaryMemories(fam.id)   // Admin SDK variant
      if (!hit) continue
      await sendToFamily(fam.id, (lang) => ({ /* … 3-years text … */ }))
    }
  })
```

The query works on the server because `date` and `familyId` are stored in
plaintext — it counts, and the content stays encrypted. The advantage over
today: the reminder arrives even when no admin opens the app that day, and it
arrives once, not once per device race.

### Step 5 — Test and make it visible

- **Test callable** `sendTestNotification` (onCall, `europe-west3`, checks
  `isFamilyAdmin` like `setSharedPassword`) sends a fixed text to the caller's
  own family. That makes the chain token → FCM → service worker checkable in
  ten seconds, without creating a memory. In the admin area as a button "Send
  test notification". *(It served its purpose and was removed again after the
  rollout.)*
- **Manual run** per device: Android/Chrome, desktop/Chrome, iOS ≥ 16.4 as an
  installed PWA. Each with the app closed, in the background, and in the
  foreground.
- **Logs**: `firebase functions:log --only notifyOnMemory` — the
  `[push] family=… sent=… failed=…` line is the quickest health check, and
  since the test button is gone the only one.
- **Rules tests** run with `npm run test:rules`; the new `fcmTokens` case
  belongs in `authRules.test.js`.

### Order

Deploy rules + client first (step 1) and collect tokens for a few days — as
long as `fcmTokens` is empty, nothing about sending can be verified. Then steps
2–4 in one functions deploy, with deleting the old `us-central1` function as
the first command.

## Deliberately not

- **No email fallback.** Push is the channel the PWA can serve without another
  provider (and without another copy of the family's data at a third party).
- **No content in the push payload**, not even "just the title". Either the
  encryption holds or it doesn't.
- **No per-user settings** in this round. A device that doesn't want
  notifications revokes the permission; the token is cleaned up on the next
  failed attempt.

## Cost

Practically zero for a handful of families: FCM is free, Cloud Scheduler has
three free jobs, and the trigger invocations stay far below the free tier of
Blaze billing. `maxInstances: 10` from `setGlobalOptions` caps outliers anyway;
`minInstances` stays at 0 so that nothing costs money while idle.

## Deploy

Done, in this order — it is not arbitrary, step 3 must come before step 4:

1. **VAPID key** in Vercel (Firebase console → Cloud Messaging → Web Push
   certificates).
2. **Rules and client first**, so that token documents accumulate — without
   them nothing about sending can be checked. The rules are now deployed by CI
   on merge to `main` (`.github/workflows/firebase-firestore.yml`).
3. **Delete the old function**:
   `firebase functions:delete dispatchPushNotifications --region us-central1`.
   A function cannot change its region; without this step both run and deliver
   twice.
4. **Deploy the functions**: `firebase deploy --only functions`. The first time,
   this creates the Cloud Scheduler job for `dailyAnniversaryCheck`.
5. **Checked**: a test notification arrived on a real device.

## After the rollout

`sendTestNotification` and the "Send test notification" button have been
removed again. They were there to make the four links of the chain —
permission, token document, function, service worker — ring together once,
when none of them had ever worked. In production they add nothing: every new
memory triggers the same path, and whether it held is in the log line.

The next `firebase deploy --only functions` offers to delete the function —
confirm it, or it stays behind as an orphan in the project.

If notifications later fail to arrive on a device, look in this order: the
permission in the browser, then `[push] … sent=0` in the log (token gone or
never written), then `failed=` (FCM rejects). The button is one revert away,
should it be needed for this after all.

## Checklist

- [x] `fcmTokens` write path without a query, with a hash id; errors are no longer swallowed
- [x] Rules for `fcmTokens` tightened (session required, deleting allowed) + emulator tests
- [x] iOS prompt only in the installed PWA (`isPushSupported`)
- [x] The token is unsubscribed on sign-out (`removeFCMToken`)
- [x] `sendToFamily` with batch sending and precise token cleanup
- [x] `notifyOnMemory` / `notifyOnMoment` in `europe-west3`, texts written on the server, author excluded
- [x] `notificationsQueue` and its client writers removed, rule set to `false`
- [x] `dailyAnniversaryCheck` via the scheduler, client lock and `lastAnniversaryCheckDate` removed
- [x] `.env.example`/README: the sentence "gen 1 works on Spark" corrected
- [x] VAPID key set, rules and client deployed
- [x] Functions deployed, test notification arrived on a real device
- [x] `sendTestNotification` and its button removed again after the rollout
- [ ] Cross-check `firebase functions:list`: no `dispatchPushNotifications`
      left in `us-central1` and no `sendTestNotification`

## Where it ended up

| Part | File |
| --- | --- |
| Registering and unsubscribing the token, iOS check | `src/utils/notifications.js` |
| Prompt incl. error message | `src/components/NotificationPrompt.jsx` |
| Author uid on memory/moment | `src/hooks/useMemories.js` |
| Unsubscribing on sign-out | `src/context/AuthContext.jsx` |
| Sending, triggers, scheduler | `functions/index.js` |
| Language choice, texts, token cleanup | `functions/push.js` |
| The "3 years ago" window | `functions/anniversary.js` |
| Rules | `firestore.rules` (`fcmTokens`, `notificationsQueue`) |
| Tests | `src/__tests__/fcmToken.test.js`, `pushNotifications.test.js`, `anniversaryWindow.test.js`, `authRules.test.js` |

One deviation from the draft above: the pure logic of sending — language
groups, texts, the decision "dead token or just a bad moment" — lives in
`functions/push.js` instead of `index.js`. It imports no firebase-admin and so
runs directly in the app's test suite, which makes the difference for exactly
the two rules the old dispatcher failed on.

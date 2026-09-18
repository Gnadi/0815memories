# Notifications — warum nichts ankommt und wie wir es richtig bauen

Es gibt einen kompletten Push-Stack im Code: Service Worker, Token-Handling,
Prompt, Queue-Collection, Cloud Function. Trotzdem hat vermutlich noch nie
jemand eine Push-Nachricht von Kaydo bekommen. Dieses Dokument sagt, woran das
liegt — jeder Punkt zeigt auf eine Datei — und wie der Stack mit Blaze aussehen
soll.

> **Stand:** umgesetzt. Der Code steht; was noch von Hand passieren muss, steht
> unter [Deploy](#deploy) — und zwar in dieser Reihenfolge, weil die alte
> Function in `us-central1` sonst weiterläuft und doppelt zustellt.

## Ist-Zustand

| Teil | Wo | Zustand |
| --- | --- | --- |
| Berechtigung + Token holen | `src/utils/notifications.js` → `requestAndSaveFCMToken` | kaputt (Befund 1) |
| Token-Ablage | Collection `fcmTokens`, Rules `firestore.rules:580` | leer |
| Prompt / Foreground-Toast | `src/components/NotificationPrompt.jsx`, `src/App.jsx` → `AppNotifications` | ok |
| Anzeige im Hintergrund | `src/sw.js` → `push` / `notificationclick` | ok |
| Auslöser „neue Erinnerung/Moment" | `src/hooks/useMemories.js:103,213` → Schreiben in `notificationsQueue` | Konzept fragwürdig (Befund 5) |
| Auslöser „3 Jahre her" | `src/hooks/useAnniversaryReminder.js` | Notlösung aus der Spark-Zeit |
| Versand | `functions/index.js` → `dispatchPushNotifications` | Gen 1, `us-central1` (Befund 2/3) |

## Die Befunde

### 1. Die Token-Registrierung scheitert an unseren eigenen Rules

`requestAndSaveFCMToken` sucht vor dem Schreiben nach einem vorhandenen
Token-Dokument:

```js
const q = query(collection(db, 'fcmTokens'), where('token', '==', token))
const existing = await getDocs(q)      // ← permission-denied
```

`firestore.rules:598` sagt für dieselbe Collection `allow read: if false`. Die
Query wirft, die Funktion bricht ab, bevor sie schreibt, und der Aufrufer in
`NotificationPrompt.handleEnable` fängt nichts ab (`try/finally`, kein `catch`)
— der Prompt schließt sich, als wäre alles gut.

Ergebnis: `fcmTokens` bleibt leer. Selbst eine perfekt deployte Function fände
`tokens.length === 0` und täte nichts. **Das ist der eigentliche Grund, warum
Notifications nicht funktionieren** — alles andere ist nachgelagert.

### 2. Der Dispatcher liegt in den USA und bleibt dort

`setGlobalOptions({ region: 'europe-west3' })` in `functions/index.js` wirkt
ausschließlich auf v2-Funktionen und steht außerdem *hinter* der Definition von
`dispatchPushNotifications`. Der v1-Trigger
(`firestore.document(...).onCreate(...)`) hat keine Region gesetzt und läuft
damit in `us-central1`.

Das lässt sich nicht per Redeploy ändern: Eine bestehende Function kann die
Region nicht wechseln, sie muss gelöscht und neu angelegt werden
(`firebase functions:delete dispatchPushNotifications`). Wer das vergisst, hat
am Ende zwei Dispatcher und doppelte Pushes.

### 3. Gen 1 war ein Spark-Workaround, der nie gestimmt hat

Der Kommentar in `.env.example` („Uses Cloud Functions gen 1, which works on the
free Firebase Spark plan") ist seit dem Artifact-Registry-/Cloud-Build-Umbau
falsch — auch Gen 1 braucht Blaze. Genau deshalb steht in der README „push ist
optional". Mit Blaze fällt der Grund für v1 komplett weg, und die v2-API
(`onDocumentCreated`) ist die, auf der der Rest der Datei bereits steht.

### 4. Die Stale-Token-Bereinigung löscht gültige Geräte

```js
const staleTokenDocs = tokenDocs.filter((_, i) => results[i].status === 'rejected')
await Promise.allSettled(staleTokenDocs.map((d) => d.ref.delete()))
```

Jeder Fehlschlag löscht das Token — auch ein kurzzeitiges `UNAVAILABLE`, ein
Quota-Fehler oder ein Netzwerk-Timeout. Ein einziger FCM-Schluckauf meldet ein
gesundes Handy dauerhaft ab, und niemand merkt es, weil der Nutzer die
Berechtigung ja längst erteilt hat. Gelöscht werden darf nur bei
`messaging/registration-token-not-registered` und `messaging/invalid-argument`.

### 5. Der Klartext-Titel im Queue-Dokument hebelt die Verschlüsselung aus

`useMemories.js:103` schreibt:

```js
body: memory.title ? `"${memory.title}" was just shared.` : ...
```

Der Titel liegt in `memories` verschlüsselt — und landet hier unverschlüsselt in
Firestore und anschließend bei Google im FCM-Payload. Dasselbe gilt für
`moment.caption`. Der ganze Aufwand aus „Stop publishing the key that encrypts
everything" ist damit für den Inhalt der Benachrichtigung aufgehoben.

Dazu kommt: Der Weg „Client schreibt beliebigen Text nach `notificationsQueue`"
ist ein Push-Kanal, dessen Inhalt niemand prüft. Die Rules validieren nur, dass
der Absender Admin der Familie ist, nicht *was* er an alle Geräte schickt.

### 6. Nebenbefunde

- **Texte sind englisch** (`'New memory added'`), obwohl die App i18n hat. Der
  Server weiß heute nicht, welche Sprache ein Gerät spricht.
- **iOS** liefert Web Push erst ab 16.4 und **nur**, wenn die PWA auf dem
  Homescreen installiert ist. Im Safari-Tab erscheint der Prompt, das Abo
  schlägt fehl. Das erklärt einen Großteil der „bei mir kommt nichts an"-Fälle,
  die nach dem Fix übrig bleiben.
- **`VITE_FIREBASE_VAPID_KEY`** muss in Vercel gesetzt sein, sonst gibt
  `requestAndSaveFCMToken` stillschweigend `null` zurück und der Prompt zeigt
  sich gar nicht erst (`NotificationPrompt.jsx:25`).
- **Der Jahrestags-Check** (`useAnniversaryReminder`) läuft nur, wenn ein Admin
  die App öffnet. Das war die Spark-Notlösung nach dem Wegfall des Vercel-Crons.

## Zielbild

```
Erinnerung/Moment wird angelegt          Cloud Scheduler (täglich 08:00 Europe/Berlin)
        │                                          │
        ▼                                          ▼
onDocumentCreated (europe-west3)          onSchedule (europe-west3)
        │                                          │
        └──────────────► sendToFamily() ◄──────────┘
                              │
                   fcmTokens (nach familyId + Sprache)
                              │
                     sendEachForMulticast
                              │
                        sw.js: push → showNotification
```

Drei Änderungen gegenüber heute: der Text entsteht **auf dem Server** (kein
Klartext aus verschlüsselten Feldern, kein vom Client steuerbarer Push),
`notificationsQueue` entfällt, und alles liegt in `europe-west3`.

## Umsetzung

### Schritt 0 — Voraussetzungen prüfen (15 Min, kein Code)

1. Firestore-Location bestätigen: `gcloud firestore databases describe --database='(default)'`.
   Bei der regionalen Location `europe-west3` (wovon auszugehen ist, weil
   `mirrorFamilyPublic`/`syncAdminClaims` dort als v2-Firestore-Trigger deployt
   sind) passen Function und Datenbank zusammen. Wäre es die Multiregion `eur3`,
   müssten die Firestore-Trigger nach `europe-west4` — dann ist das vor Schritt 2
   zu klären.
2. VAPID-Key in der Firebase Console (Cloud Messaging → Web Push certificates)
   erzeugen bzw. prüfen und als `VITE_FIREBASE_VAPID_KEY` in Vercel hinterlegen
   (alle drei Environments).
3. `firebase functions:list` — steht `dispatchPushNotifications` tatsächlich in
   `us-central1`, und laufen die vier v2-Funktionen in `europe-west3`?

### Schritt 1 — Token-Registrierung reparieren (Blocker)

`src/utils/notifications.js`: Query raus, deterministische Dokument-ID rein. Der
SHA-256 des Tokens ist die ID, damit kein Lesezugriff nötig ist und ein Gerät
genau ein Dokument hat.

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

Dazu:

- Fehler nicht mehr verschlucken: `handleEnable` bekommt ein `catch`, das in DEV
  loggt und dem Nutzer im Fehlerfall einen Hinweis zeigt.
- Beim Abmelden/Familienwechsel `deleteToken()` aufrufen und das Dokument
  löschen, statt es auf eine neue `familyId` umzubiegen.
- iOS: Prompt nur zeigen, wenn `window.matchMedia('(display-mode: standalone)')`
  oder `navigator.standalone` — sonst stattdessen den Hinweis „Zum Homescreen
  hinzufügen, dann sind Mitteilungen möglich".

`firestore.rules` entsprechend (Viewer haben seit Plan A eine echte Identität,
die Regel darf also anonyme Schreibzugriffe verbieten):

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

Test in `src/__tests__/authRules.test.js`: Fremdfamilie darf nicht schreiben,
eigenes Gerät darf schreiben und löschen, niemand darf lesen.

### Schritt 2 — Dispatcher nach europe-west3, auf v2

1. `firebase functions:delete dispatchPushNotifications --region us-central1`
   **zuerst** — sonst läuft die alte Function weiter.
2. In `functions/index.js`: `firebase-functions/v1`-Import raus,
   `setGlobalOptions` nach oben vor alle Definitionen.
3. Eine gemeinsame Versandfunktion, die alle Auslöser nutzen:

```js
async function sendToFamily(familyId, build, { excludeUid } = {}) {
  const snap = await getFirestore().collection('fcmTokens')
                  .where('familyId', '==', familyId).get()
  const docs = snap.docs.filter((d) => !excludeUid || d.data().uid !== excludeUid)
  if (docs.length === 0) return

  // Nach Sprache gruppieren — der Text entsteht hier, nicht im Client.
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
      return null                       // transiente Fehler: Token behalten
    }))
    console.log(`[push] family=${familyId} lang=${lang} ok=${res.successCount} fail=${res.failureCount}`)
  }
}
```

`sendEachForMulticast` macht aus N Einzel-Requests einen Batch (bis 500 Tokens)
und liefert pro Token einen Fehlercode — beides braucht die saubere Bereinigung
aus Befund 4.

### Schritt 3 — Auslöser auf den Server verlegen

`notificationsQueue` entfällt: Collection, die beiden `addDoc`-Aufrufe in
`useMemories.js` und der Rules-Block `firestore.rules:600`.

Stattdessen zwei Trigger, die von dort lesen, wo die Daten ohnehin entstehen:

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

analog `notifyOnMoment` auf `moments/{momentId}` mit `url: '/'`.

Kein Inhalt im Text — der Server kann und soll ihn nicht kennen. Wer mehr sehen
will, tippt auf die Notification und bekommt den entschlüsselten Titel in der
App. Der Foreground-Toast (`AppNotifications`) darf dagegen gerne den echten
Titel zeigen, dort liegt der Schlüssel ja vor.

Damit der Autor sich nicht selbst benachrichtigt, schreibt
`useMemoryWriter.addMemory` künftig `createdByUid: auth.currentUser.uid` mit
(Klartext-UID, unkritisch; `memoryContentOk()` hat keine Feld-Whitelist, die
Rules brauchen keine Änderung). Für Viewer greift die Unterdrückung nicht — sie
teilen sich die Identität `viewer:${familyId}` —, aber Viewer legen ohnehin
nichts an.

### Schritt 4 — Jahrestag als echter Scheduler

Mit Blaze gibt es Cloud Scheduler. Der Client-Lock (`useAnniversaryReminder`,
`utils/anniversaryClient.js`, das Feld `lastAnniversaryCheckDate` auf dem
Familien-Dokument) fällt weg:

```js
export const dailyAnniversaryCheck = onSchedule(
  { schedule: '0 8 * * *', timeZone: 'Europe/Berlin' },
  async () => {
    const families = await getFirestore().collection('families').select().get()
    for (const fam of families.docs) {
      const hit = await countAnniversaryMemories(fam.id)   // Admin-SDK-Variante
      if (!hit) continue
      await sendToFamily(fam.id, (lang) => ({ /* … 3-Jahre-Text … */ }))
    }
  })
```

Die Abfrage funktioniert serverseitig, weil `date` und `familyId` im Klartext
liegen — gezählt wird, der Inhalt bleibt verschlüsselt. Vorteil gegenüber heute:
die Erinnerung kommt auch dann, wenn an dem Tag kein Admin die App öffnet, und
sie kommt einmal, nicht einmal pro Gerät-Race.

### Schritt 5 — Testen und sichtbar machen

- **Test-Callable** `sendTestNotification` (onCall, `europe-west3`, prüft
  `isFamilyAdmin` wie `setSharedPassword`) schickt einen festen Text an die
  eigene Familie. Damit ist die Kette Token → FCM → Service Worker in zehn
  Sekunden prüfbar, ohne eine Erinnerung anzulegen. Im Admin-Bereich als Knopf
  „Testbenachrichtigung senden".
- **Manueller Durchlauf** je Gerät: Android/Chrome, Desktop/Chrome,
  iOS ≥ 16.4 als installierte PWA. Jeweils App geschlossen, App im Hintergrund,
  App im Vordergrund.
- **Logs**: `firebase functions:log --only notifyOnMemory` — die
  `[push] family=… ok=… fail=…`-Zeile ist der schnellste Gesundheitscheck.
- **Rules-Tests** laufen über `npm run test:rules` mit; der neue `fcmTokens`-Fall
  gehört in `authRules.test.js`.

### Reihenfolge

Zuerst Rules + Client (Schritt 1) deployen und ein paar Tage Tokens einsammeln —
solange `fcmTokens` leer ist, lässt sich am Versand nichts verifizieren. Danach
Schritt 2–4 in einem Function-Deploy, mit dem Löschen der alten `us-central1`-
Function als erstem Kommando.

## Bewusst nicht

- **Kein E-Mail-Fallback.** Push ist der Kanal, den die PWA ohne weiteren
  Anbieter (und ohne eine weitere Kopie der Familiendaten bei einem Dritten)
  bedienen kann.
- **Keine Inhalte im Push-Payload**, auch nicht „nur der Titel". Entweder die
  Verschlüsselung gilt oder sie gilt nicht.
- **Keine Pro-Nutzer-Einstellungen** in dieser Runde. Ein Gerät, das keine
  Mitteilungen will, entzieht die Berechtigung; das Token wird beim nächsten
  Fehlversuch aufgeräumt.

## Kosten

Bei einer Handvoll Familien praktisch null: FCM ist kostenlos, Cloud Scheduler
hat drei Jobs frei, die Trigger-Aufrufe liegen weit unter dem Free-Tier der
Blaze-Abrechnung. `maxInstances: 10` aus `setGlobalOptions` deckelt Ausreißer
ohnehin; `minInstances` bleibt bei 0, damit nichts im Leerlauf kostet.

## Deploy

Der Code ist auf dem Branch, die folgenden Schritte sind Handarbeit und
reihenfolgeabhängig:

1. **VAPID-Key setzen**, falls noch nicht geschehen: Firebase Console → Cloud
   Messaging → Web Push certificates → `VITE_FIREBASE_VAPID_KEY` in Vercel
   (Production, Preview, Development).
2. **Rules und Client zuerst**:
   `firebase deploy --only firestore:rules`, dann das Frontend deployen.
   Danach sammeln sich Token-Dokumente an — ohne die lässt sich der Versand
   nicht prüfen.
3. **Alte Function löschen**, bevor die neuen hochgehen:
   `firebase functions:delete dispatchPushNotifications --region us-central1`.
   Eine Function kann ihre Region nicht wechseln; ohne diesen Schritt laufen
   beide.
4. **Functions deployen**: `firebase deploy --only functions`. Beim ersten Mal
   legt Firebase für `dailyAnniversaryCheck` einen Cloud-Scheduler-Job an und
   fragt ggf. nach der Aktivierung der Scheduler-API.
5. **Prüfen**: `firebase functions:list` (alles `europe-west3`), dann in den
   Einstellungen „Testbenachrichtigung senden" — einmal mit geschlossener App,
   einmal mit offener. `firebase functions:log --only sendTestNotification`
   zeigt die `[push] family=… sent=… failed=…`-Zeile.

## Checkliste

- [x] `fcmTokens`-Schreibpfad ohne Query, mit Hash-ID; Fehler wird nicht mehr verschluckt
- [x] Rules für `fcmTokens` verschärft (Session nötig, Löschen erlaubt) + Emulator-Tests
- [x] iOS-Prompt nur in der installierten PWA (`isPushSupported`)
- [x] Token wird beim Logout abgemeldet (`removeFCMToken`)
- [x] `sendToFamily` mit Batch-Versand und präziser Token-Bereinigung
- [x] `notifyOnMemory` / `notifyOnMoment` in `europe-west3`, Texte serverseitig, Autor ausgenommen
- [x] `notificationsQueue` samt Client-Schreibern entfernt, Rule auf `false`
- [x] `dailyAnniversaryCheck` per Scheduler, Client-Lock und `lastAnniversaryCheckDate` entfernt
- [x] `sendTestNotification` + Knopf in den Einstellungen
- [x] `.env.example`/README: der Satz „gen 1 works on Spark" korrigiert
- [ ] Firestore-Location bestätigt, VAPID-Key in Vercel gesetzt
- [ ] alte `dispatchPushNotifications` in `us-central1` gelöscht
- [ ] Functions deployed, Scheduler-Job angelegt, Testbenachrichtigung angekommen

## Wo es gelandet ist

| Teil | Datei |
| --- | --- |
| Token registrieren, abmelden, iOS-Check | `src/utils/notifications.js` |
| Prompt inkl. Fehlermeldung | `src/components/NotificationPrompt.jsx` |
| Autor-UID an Erinnerung/Moment | `src/hooks/useMemories.js` |
| Abmelden beim Logout | `src/context/AuthContext.jsx` |
| Test-Knopf | `src/components/admin/TestNotificationPanel.jsx` |
| Versand, Trigger, Scheduler, Test-Callable | `functions/index.js` |
| Sprachwahl, Texte, Token-Bereinigung | `functions/push.js` |
| Zeitfenster „vor 3 Jahren" | `functions/anniversary.js` |
| Rules | `firestore.rules` (`fcmTokens`, `notificationsQueue`) |
| Tests | `src/__tests__/fcmToken.test.js`, `pushNotifications.test.js`, `anniversaryWindow.test.js`, `authRules.test.js` |

Eine Abweichung vom Entwurf oben: die reine Logik des Versands — Sprachgruppen,
Texte, die Entscheidung „totes Token oder nur ein schlechter Moment" — liegt in
`functions/push.js` statt in `index.js`. Sie importiert kein firebase-admin und
läuft damit direkt in der Test-Suite der App mit, was bei genau den beiden
Regeln, an denen der alte Dispatcher gescheitert ist, den Unterschied macht.

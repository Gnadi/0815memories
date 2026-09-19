# Ordering a printed scrapbook

How a scrapbook becomes a book in the post, and which parts are verified.

## The pipeline

```
Editor (browser)
  │  photos are decrypted here — the key never leaves the browser
  ├─ printRenderer   redraws every page onto a 300 DPI canvas (3307 × 2480 for 28 × 21 cm)
  ├─ printPreflight  reports what a press would object to, while it is still free to fix
  ├─ printFileStore  uploads the PDF to Cloud Storage under printFiles/<familyId>/<scrapbookId>/<uuid>.pdf
  │
  ▼  POST /api/print/order   (Vercel, server-side only)
  ├─ verifies the caller's Firebase ID token against Google's public keys
  ├─ verifies the print file really sits under that family's folder in our bucket
  └─ hands Peecho the tokenised download URL, with the merchant key from the environment

Peecho
  ├─ routes to the nearest press
  └─ prints and ships

printOrders/{id} (Firestore)
  ├─ records what was ordered, with the delivery address encrypted
  └─ holds the print file's object path, so the file can be released later
```

The print PDF is the **only** plaintext family content that comes to rest outside
the browser. Everything else — photos, pages, titles — travels and is stored as
ciphertext. A press cannot print ciphertext, so this one file is the exception,
and it is bounded deliberately: written only on request, under an unguessable
name, readable by that family alone, and deletable once the order is done.

## Endpoints

All under `api/print/`, all Node serverless functions, all requiring a Firebase
ID token with `role: 'admin'` — the same posture as `storage.rules`, because
ordering a book spends the operator's money and a viewer holds only the shared
family password.

| Route | Method | What it does |
|---|---|---|
| `selftest` | GET | Calls every Peecho endpoint and reports what came back |
| `offerings` | GET | The print network's catalogue |
| `quote` | POST | Price and shipping for one configuration |
| `order` | POST | Places the order |
| `status` | GET | Where an order got to |

## Verifying the Peecho integration

**The payload shapes in `api/_lib/peecho.js` are a reading, not a spec.** Peecho's
official API reference was not reachable when they were written, so the field
names come from Peecho's blog walkthrough, their knowledge base and a
third-party integration guide. Everything uncertain is marked `UNVERIFIED`, and
all of it sits at the top of that one file so correcting it is a small edit.

`selftest` exists to end the guessing. It calls each endpoint with a real
merchant key and reports Peecho's own words back.

1. In Vercel, set `PEECHO_MERCHANT_API_KEY` (test key) and a throwaway
   `PRINT_SELFTEST_SECRET`. Leave `PEECHO_MODE` unset — it defaults to the test
   environment, whose orders never reach a press.
2. Redeploy, then:

   ```bash
   curl -s https://<your-app>/api/print/selftest \
     -H "x-print-selftest: <the secret you set>" | jq
   ```

3. Read the result. Each probe says `ok: true` with a sample of the response, or
   `ok: false` with Peecho's own error text. Anything failing tells us exactly
   which endpoint path or field name in `ENDPOINTS` / `buildOrderPayload` is
   wrong.
4. **Remove `PRINT_SELFTEST_SECRET` afterwards.** Without it the route is
   admin-only like the rest.

The `offerings` response also answers the question left open by the provider
analysis: which 4:3 format Peecho actually carries, and what page limits it
really imposes. Until that has been read, `src/utils/printFormats.js` holds
conservative stand-ins that are stricter than any press, never looser — so the
preflight may refuse a book Peecho would have accepted, but never the reverse.

## Releasing the print file

The print PDF exists for as long as a press needs it, and no longer. Three
things delete it, and they all ask the same function —
`printFileRelease` in `src/utils/printOrderStatus.js`:

1. **A failed order**, immediately. A file nobody will ever fetch is exposure
   with no purpose.
2. **A status refresh** that finds the order shipped, delivered, cancelled or
   failed. This is the normal path, and it only runs while somebody has the app
   open.
3. **A nightly Cloud Function** (`releasePrintFiles`), which is the backstop for
   the orders most in need of it: the ones nobody looks at again. It also
   deletes any print file older than 30 days whatever its status says, and logs
   a warning when it has to — an order that ages out is one status tracking lost.

An unrecognised provider status never advances an order, because a wrong
"shipped" would delete a print file while the press was still reading it.

## Still open

- `status` trusts the order reference it is given. It should check the reference
  against that family's own `printOrders` rows now that they exist.
- Download URLs never expire. Deleting the object is the only revocation, which
  is why the sweep above matters more than it looks.
- **Who collects the money is unconfirmed.** Peecho's hosted checkout collects
  from the customer and makes them merchant of record, which is what the
  provider analysis recommended them for. Whether the *Print API* path does the
  same, or bills the merchant account directly, is part of the documentation
  that was not reachable. The selftest and the Peecho dashboard will say. If it
  bills the merchant account, collecting from families becomes the operator's
  problem again and the payment question from the analysis reopens.

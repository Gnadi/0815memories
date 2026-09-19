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
  ├─ collects payment, charges VAT, routes to the nearest press
  └─ prints, ships, and handles support
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

## Still open

- **Nothing deletes a print file yet.** `deletePrintFile` exists and the order
  response hands back the object path, but no caller wires them together. Until
  fulfilment does, an uploaded print file stays in the bucket indefinitely. This
  is the most important loose end.
- `status` trusts the order reference it is given. Once orders are recorded in
  Firestore it should check the reference against that family's own rows.
- Download URLs never expire. Deleting the object is the only revocation.

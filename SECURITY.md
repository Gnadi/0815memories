# Security policy

Kaydo holds families' photos, letters and children's journals. A weakness in
it can expose exactly the things people trusted it with, so please report one
privately and give us the chance to fix it before it is public.

## Reporting a vulnerability

**Do not open a public issue, discussion or pull request for a security
problem.**

Report it through GitHub's private vulnerability reporting:
[Security → Report a vulnerability](https://github.com/Gnadi/0815memories/security/advisories/new).
Only the maintainers can see the report, and we can work on the fix with you
in a private fork.

Please include:

- what an attacker can do, and what they need for it (a viewer's shared
  password, an admin account, nothing at all)
- the steps to reproduce it, ideally against the local emulators
  (`npm run dev:local`)
- the commit or deployment you tested

Kaydo is maintained by volunteers. We will acknowledge a report as soon as we
can and keep you informed until it is fixed. Unless you ask us not to, we
credit reporters in the advisory.

## Scope

Most interesting to us:

- **Access control** — `firestore.rules`: anyone reading or writing another
  family's data, a viewer doing what only an admin may, a partner's
  *Our Year* answers or a sealed letter readable before their time
- **Viewer login and tokens** — `functions/viewerLogin.js`,
  `functions/index.js`: getting a family token without the password, or
  getting around the rate limit
- **Encryption** — `src/utils/encryption.js`, `src/utils/encryptedUpload.js`:
  content or media reaching Cloudinary or Firestore unencrypted, or a key
  leaking
- **Upload signing** — `api/cloudinary-sign.js`: a signature for anyone who
  is not an admin of the family
- **Cross-site scripting** — through memories, rich text, or the login page
  designer's custom HTML and CSS
- **The workflows** — `.github/workflows/`: anything that exposes a secret or
  lets a pull request deploy

## Please don't

- test against the hosted service at kaydo.app or its family subdomains —
  they hold real families' data. The local emulators have the same rules and
  functions, with a demo family (`npm run dev:local`, see the README)
- access, change or keep data that is not yours, or run denial-of-service or
  spam tests

## Known limitations

These are documented design limits, not vulnerabilities — reports that
depend only on them will be closed with a pointer here:

- **Kaydo is not zero-knowledge.** The per-family encryption key is stored in
  the family's Firestore document, readable by the family and by whoever
  operates the Firebase project. See *Security & encryption* in the README.
- The login page's design (`familyPublic/{familyId}`) is public by design:
  it has to render before anyone is signed in.
- App feedback is stored unencrypted on purpose; the form says so.

## Supported versions

Kaydo has no versioned releases yet. Fixes go to `main` and, from there, to
the hosted service. If you run your own instance, stay on the latest `main`.

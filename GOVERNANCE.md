# Governance

Kaydo holds families' photos, letters and children's journals. People
entrust it with that only if it is clear who can reach their data. This
document says so, and says how the project is run.

## The software and the service

- **The software** in this repository is open source under the
  [MIT License](LICENSE). Anyone may read, use, change and redistribute it.
- **The service** at [kaydo.app](https://kaydo.app) and its family addresses
  (`<name>.kaydo.app`) runs this software. It is operated by Johannes
  Gnadlinger, the *operator*. The terms, privacy policy and imprint in the app
  are the operator's and apply to the service only.

Contributing to the software gives no role in the service and no access to
it.

## Who can reach the service's data

**Only the operator has access to the production systems and the data in
them.** Today that is one person: Johannes Gnadlinger.

Production means:

- the production Firebase project — Firestore with all family documents
  (including the per-family encryption keys), Authentication, Cloud Functions
  and their logs
- the Cloudinary account that stores the encrypted media
- the Vercel project and its environment variables
- the deploy credentials in this repository's GitHub settings
- the `support@` and `privacy@kaydo.app` mailboxes and the in-app `feedback`
  collection, which contain what users write to us

Maintainers and contributors have none of these, and do not need them: the
whole app runs locally against the emulators with a demo family
(`npm run dev:local`). No one working on the code will ever ask a family for
their data, their password or access to their account. Bug reports with real
data go to the operator, not into an issue.

### What the operator could technically do

Kaydo is **not** zero-knowledge (see *Security & encryption* in the README):
each family's encryption key is stored in the family's Firestore document, so
the operator could technically decrypt that family's content. The operator
does not access family content, except

- when a family asks for help with their own data and agrees to it, or
- when the law requires it.

The infrastructure providers named in the privacy policy (Google Firebase,
Cloudinary, Vercel) process the data as hosts; what they can see is described
there.

### Changing who has access

Access to production is never granted quietly. Before anyone else gets it,
this section is changed by a pull request that names the person and what
they get access to, so users can see it. The same applies when someone loses
access.

## How the code reaches production

Code reaches the service only through `main`:

- Firestore rules and indexes are deployed by CI when a change to them is
  merged (`.github/workflows/firebase-firestore.yml`). The deploy credentials
  are used only by that job, on `main`.
- The Cloud Functions and the web app are deployed by the operator.

Changes to what guards the data — `firestore.rules`, `functions/`, `api/`,
the encryption code and the workflows — need the operator's review
(`.github/CODEOWNERS`).

## Roles

| Role | Who | Can |
| --- | --- | --- |
| Operator | Johannes Gnadlinger | everything above; decides on the project's direction |
| Maintainer | none yet | review and merge pull requests, triage issues — no production access |
| Contributor | anyone | open issues and pull requests (see [CONTRIBUTING.md](CONTRIBUTING.md)) |

Maintainers are invited by the operator after sustained, careful
contributions. They are listed here when they join.

## Decisions

For now the operator decides, after discussion in the open. Bigger changes —
new features, changes to the data model, the rules or the encryption — start
as an issue, so that the approach is agreed before code is written. As more
people join, this section will describe how decisions are shared.

## Security

Vulnerabilities are reported privately, as described in
[SECURITY.md](SECURITY.md). The operator handles them, and handles any
incident that affects the service, including telling the affected families.

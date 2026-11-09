# 0001 — One encryption contract per document type

Status: proposed

## What is true today

Whether a piece of text is encrypted depends on the feature that stored it, not
on what it is.

- Memories encrypt `title`, `content`, `quote`, `location`, `authorName` and
  `category` (`MEMORY_TEXT_FIELDS`, `src/services/memories.js`).
- Moments keep `caption`, `category`, `location` and `label` in clear, on
  purpose (header of `src/services/moments.js`, `docs/moments-decryption.md`).
  Converting a memory to a moment therefore moves its title and story into a
  cleartext `caption` (`src/utils/entryConversion.js`).
- Journals encrypt `content` and `contentRich` only (`JOURNAL_ENCRYPTED_FIELDS`,
  `src/services/journals.js`); `title` and `volume` are stored in clear, and
  `journalContentOk` in `firestore.rules` does not ask for more.
- A recipe fork's `changes` (ingredient and description text) is not in
  `ENCRYPTED_TEXT_FIELDS` (`src/services/recipes.js`).
- Each service keeps its own field list; the rules repeat the lists by hand
  (`encryptedOk` and its callers). Nothing checks that the two agree.
- The family key cannot change: `keepsEncryptionKey()` in `firestore.rules`
  refuses any update that touches `encryptionKeyJwk`. That prevents losing the
  key by accident, and it also means there is no way to rotate it after it was
  shared with someone who should no longer have it.

What stays true whatever is decided: the key lives in the family document, so
Kaydo is not zero-knowledge (SECURITY.md), and a key or data someone already
copied cannot be taken back.

## Options

**A — Document the exceptions.** Keep the storage as it is; write one table of
"encrypted / clear on purpose / public" per document type into
`docs/architecture.md` and say in the UI where text is stored in clear. No
migration. The inconsistency stays, but it is stated.

**B — One contract, enforced.** A single module lists, per collection, the
encrypted fields, the cleartext metadata that queries need (dates, ids,
`familyId`, flags) and the public fields. Services take their lists from it,
and a test generates the expectation the rules must meet, so a field added to
one side and not the other fails CI. Moments, journal `title`/`volume` and
recipe `changes` become encrypted. Existing documents are migrated by an admin's
client (the server has no business holding the key): a versioned, resumable
pass like the media index (`src/services/mediaIndex.js`), with the rules
accepting both shapes until a family is marked migrated.

**C — B plus key versions.** Ciphertext carries a `keyVersion`; the family
document holds the current key and, while a rotation runs, the previous one.
Rotation re-encrypts in the same resumable pass. Media files are the expensive
part: each is re-uploaded, or media keeps a wrapped per-file key so that only
the wrapping changes.

## Recommendation

B now, and shape its format so that C can follow: add the version marker to
new ciphertext in B, even while there is only one key. Rotation itself (C) is
worth building once removing an admin is expected to be routine; until then the
honest statement is the one in SECURITY.md.

Moments need a product decision first: their text is in clear so that the feed
can show them without the decrypt step (`docs/moments-decryption.md`). B costs
that shortcut.

## Cost and order

1. Contract module, generated rules test — small, no behaviour change.
2. Journal `title`/`volume` and recipe `changes` — small each, plus migration.
3. Moments — medium: write path, read path, conversion, migration, feed
   performance.
4. Key versions — large; media is most of it.

## Open questions

- May moments lose their cleartext shortcut, or does the feed need them fast?
- Who runs a migration for a family whose admins never open the app again?

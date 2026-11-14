// @vitest-environment node
/**
 * A collection added to firestore.rules has to say what happens to it when its
 * family is deleted — functions/familyDeletion.js. Without this, a new
 * collection would simply be left behind, and nothing would notice.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { FAMILY_COLLECTIONS, OTHER_COLLECTIONS } from '../../functions/familyDeletion.js'
import { MEDIA_COLLECTIONS } from '../../functions/mediaRefs.js'

const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8')
const topLevel = [...new Set([...rules.matchAll(/^ {4}match \/([A-Za-z]+)\/\{/gm)].map((m) => m[1]))]

describe('family deletion covers every collection', () => {
  it('reads the collections out of firestore.rules', () => {
    expect(topLevel).toContain('memories')
    expect(topLevel).toContain('families')
    expect(topLevel.length).toBeGreaterThan(20)
  })

  it('knows every collection of the rules, each in one list', () => {
    const known = [...FAMILY_COLLECTIONS, ...Object.keys(OTHER_COLLECTIONS)]
    expect([...known].sort()).toEqual([...new Set(known)].sort())
    expect(topLevel.filter((name) => !known.includes(name))).toEqual([])
  })

  it('deletes the documents of every collection that holds media', () => {
    expect(MEDIA_COLLECTIONS.filter((name) => name !== 'families' && !FAMILY_COLLECTIONS.includes(name))).toEqual([])
  })
})

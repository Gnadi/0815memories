import { describe, it, expect } from 'vitest'
import { buildAnniversaryPayloads } from '../../functions/anniversaryHelpers.js'

// Helper to create a fake Firestore document snapshot
function makeDoc(familyId) {
  return { data: () => ({ familyId }) }
}

const THREE_YEARS_AGO = new Date(2023, 3, 16) // April 16, 2023

describe('buildAnniversaryPayloads', () => {
  it('returns empty array when there are no docs', () => {
    const result = buildAnniversaryPayloads([], THREE_YEARS_AGO)
    expect(result).toEqual([])
  })

  it('returns one payload for a single family with one memory', () => {
    const docs = [makeDoc('family-A')]
    const result = buildAnniversaryPayloads(docs, THREE_YEARS_AGO)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ familyId: 'family-A', count: 1, year: 2023 })
  })

  it('accumulates count for multiple memories in the same family', () => {
    const docs = [makeDoc('family-A'), makeDoc('family-A'), makeDoc('family-A')]
    const result = buildAnniversaryPayloads(docs, THREE_YEARS_AGO)
    expect(result).toHaveLength(1)
    expect(result[0].count).toBe(3)
  })

  it('returns one payload per family when multiple families have memories', () => {
    const docs = [
      makeDoc('family-A'),
      makeDoc('family-B'),
      makeDoc('family-A'),
      makeDoc('family-C'),
    ]
    const result = buildAnniversaryPayloads(docs, THREE_YEARS_AGO)
    expect(result).toHaveLength(3)

    const byId = Object.fromEntries(result.map((r) => [r.familyId, r]))
    expect(byId['family-A'].count).toBe(2)
    expect(byId['family-B'].count).toBe(1)
    expect(byId['family-C'].count).toBe(1)
  })

  it('ignores documents without a familyId', () => {
    const docs = [makeDoc(undefined), makeDoc(null), makeDoc('family-A')]
    const result = buildAnniversaryPayloads(docs, THREE_YEARS_AGO)
    expect(result).toHaveLength(1)
    expect(result[0].familyId).toBe('family-A')
  })

  it('sets year from the threeYearsAgoDate argument', () => {
    const docs = [makeDoc('family-X')]
    const result = buildAnniversaryPayloads(docs, new Date(2019, 5, 1))
    expect(result[0].year).toBe(2019)
  })
})

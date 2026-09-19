/**
 * Tests for the ordering rules that are not about the network.
 *
 * Two of these decide something that matters beyond correctness: when the
 * plaintext print file is allowed to be deleted, and whether a provider status
 * we do not recognise may move an order forward. Getting the second one wrong
 * deletes somebody's print file while the press is still reading it.
 */
import { describe, it, expect } from 'vitest'
import { normalizeOfferings, offeringsForFormat } from '../utils/printCatalog'
import {
  STATUS, PRINT_FILE_MAX_AGE_DAYS, isFinalStatus, mapProviderStatus, printFileRelease, toMillis,
} from '../utils/printOrderStatus'
import { addressErrors, EMPTY_ADDRESS } from '../utils/printAddress'
import { getFormat } from '../utils/printFormats'

describe('normalizeOfferings', () => {
  it('reads a bare array', () => {
    const { offerings, unreadable } = normalizeOfferings([{ id: 7, title: 'Hardcover 28×21' }])
    expect(unreadable).toBe(false)
    expect(offerings[0]).toMatchObject({ id: 7, name: 'Hardcover 28×21' })
  })

  it('reads the common wrapper keys', () => {
    for (const key of ['offerings', 'data', 'results', 'items', 'products']) {
      const { offerings } = normalizeOfferings({ [key]: [{ offering_id: 1, name: 'X' }] })
      expect(offerings).toHaveLength(1)
    }
  })

  it('reads one level of nesting', () => {
    const { offerings } = normalizeOfferings({ offerings: { data: [{ id: 2, label: 'Y' }] } })
    expect(offerings[0]).toMatchObject({ id: 2, name: 'Y' })
  })

  it('accepts any of the id spellings a catalogue might use', () => {
    for (const key of ['offering_id', 'offeringId', 'id', 'sku', 'code']) {
      const { offerings } = normalizeOfferings([{ [key]: 'abc', name: 'X' }])
      expect(offerings[0].id).toBe('abc')
    }
  })

  it('says so when it cannot find a list, rather than pretending the catalogue is empty', () => {
    // An empty dropdown with no explanation sends people nowhere; "I could not
    // read this" sends them to the selftest.
    expect(normalizeOfferings({ message: 'unauthorized' })).toEqual({ offerings: [], unreadable: true })
    expect(normalizeOfferings(null)).toEqual({ offerings: [], unreadable: true })
  })

  it('distinguishes a genuinely empty catalogue from an unreadable one', () => {
    expect(normalizeOfferings([])).toEqual({ offerings: [], unreadable: false })
  })

  it('drops entries with no id, which could not be ordered anyway', () => {
    const { offerings } = normalizeOfferings([{ name: 'No id here' }, { id: 1, name: 'Fine' }])
    expect(offerings).toHaveLength(1)
  })

  it('reads page limits only when they are real numbers', () => {
    const { offerings } = normalizeOfferings([
      { id: 1, min_pages: 24, max_pages: 300 },
      { id: 2, min_pages: 'lots' },
    ])
    expect(offerings[0]).toMatchObject({ minPages: 24, maxPages: 300 })
    // A missing limit read as 0 would reject every book.
    expect(offerings[1]).toMatchObject({ minPages: null, maxPages: null })
  })
})

describe('offeringsForFormat', () => {
  const format = getFormat('landscape-28x21')

  it('keeps the offerings that match the chosen physical size', () => {
    const offerings = [
      { id: 1, widthMm: 280, heightMm: 210 },
      { id: 2, widthMm: 200, heightMm: 150 },
    ]
    expect(offeringsForFormat(offerings, format).map((o) => o.id)).toEqual([1])
  })

  it('keeps offerings that state no size at all', () => {
    // Hiding the only right answer behind a filter is worse than showing an
    // unlabelled entry the user can still pick.
    const offerings = [{ id: 3, widthMm: null, heightMm: null }]
    expect(offeringsForFormat(offerings, format)).toHaveLength(1)
  })

  it('tolerates a millimetre of rounding', () => {
    expect(offeringsForFormat([{ id: 4, widthMm: 279.6, heightMm: 210.4 }], format)).toHaveLength(1)
  })
})

describe('mapProviderStatus', () => {
  it('recognises the states a print network reports', () => {
    expect(mapProviderStatus('SHIPPED')).toBe(STATUS.SHIPPED)
    expect(mapProviderStatus('in_production')).toBe(STATUS.IN_PRODUCTION)
    expect(mapProviderStatus('Delivered')).toBe(STATUS.DELIVERED)
    expect(mapProviderStatus('payment_received')).toBe(STATUS.PLACED)
    expect(mapProviderStatus('cancelled')).toBe(STATUS.CANCELLED)
    expect(mapProviderStatus('error')).toBe(STATUS.FAILED)
  })

  it('keeps the status we already had when it does not recognise one', () => {
    // The vocabulary is unverified, so an unknown string must not invent a
    // transition: a wrong "shipped" deletes the print file mid-production.
    expect(mapProviderStatus('flurbled', STATUS.IN_PRODUCTION)).toBe(STATUS.IN_PRODUCTION)
    expect(mapProviderStatus('', STATUS.PLACED)).toBe(STATUS.PLACED)
    expect(mapProviderStatus(undefined, STATUS.PLACED)).toBe(STATUS.PLACED)
  })

  it('reads a failure before a success when a string contains both', () => {
    expect(mapProviderStatus('shipping_failed')).toBe(STATUS.FAILED)
  })
})

describe('printFileRelease', () => {
  const now = Date.UTC(2026, 8, 19)
  const daysAgo = (n) => now - n * 24 * 60 * 60 * 1000

  const order = (overrides) => ({
    printFilePath: 'printFiles/f/b/x.pdf',
    printFileDeletedAt: null,
    status: STATUS.PLACED,
    createdAt: daysAgo(1),
    ...overrides,
  })

  it('holds the file while the press still needs it', () => {
    expect(printFileRelease(order({ status: STATUS.IN_PRODUCTION }), { now }))
      .toEqual({ release: false, reason: 'stillNeeded' })
  })

  it('releases once the book has shipped', () => {
    expect(printFileRelease(order({ status: STATUS.SHIPPED }), { now }))
      .toEqual({ release: true, reason: 'done' })
  })

  it('releases a failed order at once, since nobody will ever fetch it', () => {
    expect(printFileRelease(order({ status: STATUS.FAILED }), { now }))
      .toEqual({ release: true, reason: 'done' })
    expect(printFileRelease(order({ status: STATUS.CANCELLED }), { now }))
      .toEqual({ release: true, reason: 'done' })
  })

  it('releases an order that aged out whatever its status says', () => {
    // The case that actually happens: status tracking lost the order and the
    // file would otherwise sit there forever.
    expect(printFileRelease(order({ createdAt: daysAgo(PRINT_FILE_MAX_AGE_DAYS + 1) }), { now }))
      .toEqual({ release: true, reason: 'expired' })
  })

  it('does not release one day before the cutoff', () => {
    expect(printFileRelease(order({ createdAt: daysAgo(PRINT_FILE_MAX_AGE_DAYS - 1) }), { now }).release)
      .toBe(false)
  })

  it('does nothing twice', () => {
    expect(printFileRelease(order({ status: STATUS.SHIPPED, printFileDeletedAt: now }), { now }))
      .toEqual({ release: false, reason: 'alreadyDeleted' })
  })

  it('does nothing for an order that never had a file', () => {
    expect(printFileRelease(order({ printFilePath: null }), { now }))
      .toEqual({ release: false, reason: 'noFile' })
  })

  it('never releases on a missing timestamp alone', () => {
    // An order with no createdAt is a bug, and deleting its file would turn a
    // bug into a lost print run.
    expect(printFileRelease(order({ createdAt: null }), { now }).release).toBe(false)
  })
})

describe('toMillis', () => {
  it('reads the timestamp shapes Firestore hands back', () => {
    const ms = Date.UTC(2026, 0, 1)
    expect(toMillis(ms)).toBe(ms)
    expect(toMillis(new Date(ms))).toBe(ms)
    expect(toMillis({ toMillis: () => ms })).toBe(ms)
    expect(toMillis({ seconds: ms / 1000 })).toBe(ms)
    expect(toMillis('2026-01-01T00:00:00.000Z')).toBe(ms)
  })

  it('returns null rather than NaN for nonsense', () => {
    expect(toMillis(null)).toBeNull()
    expect(toMillis('not a date')).toBeNull()
  })
})

describe('isFinalStatus', () => {
  it('counts shipped as not yet final — a parcel can still fail to arrive', () => {
    expect(isFinalStatus(STATUS.SHIPPED)).toBe(false)
    expect(isFinalStatus(STATUS.DELIVERED)).toBe(true)
    expect(isFinalStatus(STATUS.FAILED)).toBe(true)
  })
})

describe('addressErrors', () => {
  const good = {
    ...EMPTY_ADDRESS,
    name: 'Familie Muster',
    line1: 'Beispielweg 1',
    postalCode: '80331',
    city: 'München',
    countryCode: 'DE',
    email: 'familie@example.com',
  }

  it('passes a complete address', () => {
    expect(addressErrors(good)).toEqual({})
  })

  it('flags every missing required field, and no optional ones', () => {
    const errors = addressErrors(EMPTY_ADDRESS)
    expect(Object.keys(errors).sort()).toEqual(['city', 'email', 'line1', 'name', 'postalCode'])
  })

  it('matches the rules the endpoint enforces, so the form fails first', () => {
    expect(addressErrors({ ...good, countryCode: 'Deutschland' })).toMatchObject({ countryCode: 'country' })
    expect(addressErrors({ ...good, email: 'nope' })).toMatchObject({ email: 'email' })
  })

  it('treats whitespace as empty', () => {
    expect(addressErrors({ ...good, city: '  ' })).toMatchObject({ city: 'required' })
  })
})

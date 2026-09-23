/**
 * Reading the print network's catalogue without knowing its exact shape.
 *
 * An order needs an offering id, and only the provider knows what those are.
 * Peecho's response shape is part of the API reference that was not reachable
 * when this was written, so rather than guessing one shape and breaking on
 * every other, this accepts the handful that catalogue endpoints actually use
 * and says plainly when it recognises none of them.
 *
 * That last part is the point. A parser that silently returns an empty list
 * when it does not understand the response produces a dialog with no products
 * and no explanation; one that says "I could not read this" sends somebody to
 * `/api/print/selftest`, which answers the question in one request.
 */

/** Where a list might be hiding in the response. */
const LIST_KEYS = ['offerings', 'data', 'results', 'items', 'products']

/** What an item's id might be called. */
const ID_KEYS = ['offering_id', 'offeringId', 'id', 'sku', 'code']

/** What an item's human name might be called. */
const NAME_KEYS = ['title', 'name', 'label', 'description', 'product_name']

function firstKey(item, keys) {
  for (const key of keys) {
    const value = item?.[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return null
}

function findList(raw) {
  if (Array.isArray(raw)) return raw
  if (!raw || typeof raw !== 'object') return null
  for (const key of LIST_KEYS) {
    if (Array.isArray(raw[key])) return raw[key]
    // One level of nesting, for { offerings: { data: [...] } }.
    if (raw[key] && typeof raw[key] === 'object') {
      for (const inner of LIST_KEYS) {
        if (Array.isArray(raw[key][inner])) return raw[key][inner]
      }
    }
  }
  return null
}

/**
 * Pull page limits out of an offering, when it states them.
 *
 * These are the numbers `printFormats.js` currently stands in for with
 * conservative guesses. Once the provider reports its own, they should win —
 * but only when they are actually numbers, because a missing limit read as 0
 * would reject every book.
 */
function readPageLimits(item) {
  const min = Number(firstKey(item, ['min_pages', 'minPages', 'pages_min']))
  const max = Number(firstKey(item, ['max_pages', 'maxPages', 'pages_max']))
  return {
    minPages: Number.isFinite(min) && min > 0 ? min : null,
    maxPages: Number.isFinite(max) && max > 0 ? max : null,
  }
}

function readSize(item) {
  const width = Number(firstKey(item, ['width_mm', 'widthMm', 'width']))
  const height = Number(firstKey(item, ['height_mm', 'heightMm', 'height']))
  return {
    widthMm: Number.isFinite(width) && width > 0 ? width : null,
    heightMm: Number.isFinite(height) && height > 0 ? height : null,
  }
}

/**
 * Normalize a catalogue response into `{ offerings, unreadable }`.
 *
 * `unreadable` is true when nothing list-shaped was found at all — which is a
 * different thing from a catalogue that is genuinely empty, and the UI says so
 * differently.
 */
export function normalizeOfferings(raw) {
  const list = findList(raw)
  if (!list) return { offerings: [], unreadable: true }

  const offerings = list
    .map((item) => {
      const id = firstKey(item, ID_KEYS)
      if (id === null) return null
      const { widthMm, heightMm } = readSize(item)
      return {
        id,
        name: String(firstKey(item, NAME_KEYS) ?? `#${id}`),
        widthMm,
        heightMm,
        ...readPageLimits(item),
        raw: item,
      }
    })
    .filter(Boolean)

  return { offerings, unreadable: false }
}

/**
 * The offerings whose physical size matches a format, within a millimetre.
 *
 * Catalogues list every product a network carries; a family choosing a 28 × 21
 * book should not have to scroll past posters and mugs. Offerings that do not
 * state a size are kept rather than hidden — an unlabelled entry the user can
 * still pick beats a filter that quietly removes the only right answer.
 */
export function offeringsForFormat(offerings, format, toleranceMm = 1) {
  if (!format) return offerings
  return offerings.filter((offering) => {
    if (offering.widthMm === null || offering.heightMm === null) return true
    return Math.abs(offering.widthMm - format.widthMm) <= toleranceMm
      && Math.abs(offering.heightMm - format.heightMm) <= toleranceMm
  })
}

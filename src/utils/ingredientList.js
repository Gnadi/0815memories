/**
 * Ingredients out of pasted text: a list from a recipe site or a note, a
 * table copied from a spreadsheet or a web page, a Markdown list or table.
 *
 * One ingredient per line. Table cells are joined with a space, so a row of
 * "200 g | Mehl" becomes "200 g Mehl". List markers and checkboxes go, and so
 * do lines that only name a section ("Für den Teig:") and a table's header row.
 */

// "- ", "* ", "• ", "1. ", "2) ", "[ ] ", "☐ " — a number only with a dot or
// bracket and a space after it, so "2.5 kg" and "1 Ei" keep theirs.
const LIST_MARKER = /^(?:[-*+•·▪◦–—]\s+|\d{1,3}[.)]\s+|\[[ xX]\]\s*|[☐☑✓✔]\s*)/

const TABLE_SEPARATOR = /^[\s|:+-]*-{2,}[\s|:+-]*$/

// Words a table's header row is made of, in the languages the app speaks.
const HEADER_WORDS = new Set([
  'menge', 'zutat', 'zutaten', 'einheit', 'anzahl', 'name', 'gewicht',
  'amount', 'quantity', 'qty', 'ingredient', 'ingredients', 'unit', 'weight',
])

const SECTION_WORDS = new Set(['zutaten', 'zutat', 'ingredients', 'ingredient'])

function cellsOf(line) {
  if (line.includes('\t')) return line.split('\t')
  if (line.includes('|')) return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|')
  return null
}

function stripMarkers(text) {
  let out = text.trim()
  for (let previous = ''; previous !== out;) {
    previous = out
    out = out.replace(LIST_MARKER, '').trim()
  }
  return out.replace(/\*\*|__/g, '').replace(/\s+/g, ' ').trim()
}

function isSection(text) {
  if (/^#{1,6}\s/.test(text)) return true
  if (text.endsWith(':')) return true
  return SECTION_WORDS.has(text.toLowerCase())
}

/**
 * The ingredients in `text`, in order. A single line without line breaks is
 * read as a comma- or semicolon-separated list ("Mehl, Zucker; Eier") — a comma
 * only with a space after it, so "1,5 kg Mehl" stays whole.
 */
export function parseIngredientList(text) {
  if (typeof text !== 'string') return []
  let lines = text.replace(/\r\n?/g, '\n').split('\n').filter((line) => line.trim())
  if (lines.length === 1 && !cellsOf(lines[0])) lines = lines[0].split(/\s*;\s*|,\s+/)

  const out = []
  let tableRow = 0
  for (const line of lines) {
    if (TABLE_SEPARATOR.test(line)) continue
    const cells = cellsOf(line)
    let text
    if (cells) {
      const values = cells.map(stripMarkers).filter(Boolean)
      const isHeader = tableRow === 0 && values.length > 0
        && values.every((value) => HEADER_WORDS.has(value.toLowerCase()))
      tableRow += 1
      if (isHeader) continue
      text = values.join(' ')
    } else {
      tableRow = 0
      text = stripMarkers(line)
    }
    if (text && !isSection(text)) out.push(text)
  }
  return out
}

/** True for pasted text that holds more than one ingredient. */
export function isIngredientList(text) {
  return typeof text === 'string' && /[\n\t]/.test(text.trim())
}

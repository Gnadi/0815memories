/* Ingredients out of pasted text: lists, spreadsheet and Markdown tables, and
   a comma-separated line, without the markers, section names and header rows
   that come along. */
import { describe, it, expect } from 'vitest'
import { isIngredientList, parseIngredientList } from '../utils/ingredientList'

describe('parseIngredientList', () => {
  it('reads one ingredient per line, without list markers', () => {
    expect(parseIngredientList('- 200 g Mehl\n* 2 Eier\n• 1 Prise Salz\n1. 100 ml Milch\n2) Butter\n- [ ] Zucker\n☐ Zimt'))
      .toEqual(['200 g Mehl', '2 Eier', '1 Prise Salz', '100 ml Milch', 'Butter', 'Zucker', 'Zimt'])
  })

  it('keeps numbers that are amounts', () => {
    expect(parseIngredientList('2.5 kg Äpfel\n1 Ei\n1,5 l Wasser')).toEqual(['2.5 kg Äpfel', '1 Ei', '1,5 l Wasser'])
  })

  it('leaves out empty lines and section names', () => {
    expect(parseIngredientList('Zutaten\n\nFür den Teig:\n250 g Mehl\n\n## Füllung\n4 Äpfel\nIngredients:'))
      .toEqual(['250 g Mehl', '4 Äpfel'])
  })

  it('joins the cells of a spreadsheet row, and skips its header', () => {
    expect(parseIngredientList('Menge\tZutat\r\n200 g\tMehl\r\n3\tEier\r\n\tPrise Salz'))
      .toEqual(['200 g Mehl', '3 Eier', 'Prise Salz'])
  })

  it('reads a Markdown table', () => {
    expect(parseIngredientList('| Amount | Ingredient |\n|---|:---:|\n| 2 cups | flour |\n| 1 tsp | **baking powder** |'))
      .toEqual(['2 cups flour', '1 tsp baking powder'])
  })

  it('keeps a first table row that is an ingredient', () => {
    expect(parseIngredientList('200 g\tMehl\n2\tEier')).toEqual(['200 g Mehl', '2 Eier'])
  })

  it('splits a single line at commas and semicolons', () => {
    expect(parseIngredientList('Mehl, Zucker; 1,5 kg Äpfel, Zimt')).toEqual(['Mehl', 'Zucker', '1,5 kg Äpfel', 'Zimt'])
  })

  it('tidies whitespace', () => {
    expect(parseIngredientList('   200   g    Mehl   ')).toEqual(['200 g Mehl'])
  })

  it('gives nothing for nothing', () => {
    expect(parseIngredientList('')).toEqual([])
    expect(parseIngredientList(undefined)).toEqual([])
  })
})

describe('isIngredientList', () => {
  it('is a list with a line break or a tab', () => {
    expect(isIngredientList('Mehl\nZucker')).toBe(true)
    expect(isIngredientList('200 g\tMehl')).toBe(true)
    expect(isIngredientList('200 g Mehl\n')).toBe(false)
    expect(isIngredientList('Mehl, Zucker')).toBe(false)
  })
})

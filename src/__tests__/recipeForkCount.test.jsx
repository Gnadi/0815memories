/* The fork count on a recipe card. RecipeCard read `forkCount`, which nothing
   ever wrote, so every family recipe said "0 forks" however many versions it
   had. The count now comes from the lineage the recipe list already loads. */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

let deliver = null
vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ name })),
  query: vi.fn((ref, ...c) => ({ ref, c })),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn((_q, next) => {
    deliver = next
    return () => {}
  }),
}))
vi.mock('../config/firebase', () => ({ db: {} }))

import { useRecipes } from '../hooks/useRecipes'
import { countForks } from '../services/recipes'

// Strudel → Mom's strudel → Emma's mini strudel; pancakes on their own.
const lineage = [
  { id: 'mini', parentId: 'moms', rootId: 'strudel', title: "Emma's mini strudel" },
  { id: 'pancakes', parentId: null, rootId: null, title: 'Pancakes' },
  { id: 'moms', parentId: 'strudel', rootId: 'strudel', title: "Mom's strudel" },
  { id: 'strudel', parentId: null, rootId: null, title: "Grandma's strudel" },
]

describe('countForks', () => {
  it('counts every version grown from a root, forks of forks included', () => {
    const counts = countForks(lineage)
    expect(counts.get('strudel')).toBe(2)
    expect(counts.get('pancakes')).toBeUndefined()
  })
})

describe('useRecipes', () => {
  it('hands each family recipe its fork count', async () => {
    const { result } = renderHook(() => useRecipes('family-1', null))
    deliver({ docs: lineage.map(({ id, ...data }) => ({ id, data: () => data })) })

    await waitFor(() => expect(result.current.recipes).toHaveLength(2))
    const byId = Object.fromEntries(result.current.recipes.map((r) => [r.id, r.forkCount]))
    expect(byId).toEqual({ pancakes: 0, strudel: 2 })
  })
})

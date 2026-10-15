/* The evolution tree of a recipe. It used to be a flat list ordered by year,
   so two forks of the same recipe looked like one version after the other. */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { buildLineageTree, newestVersion } from '../utils/recipeLineage'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => (opts && typeof opts === 'object' ? `${key} ${JSON.stringify(opts)}` : key),
  }),
}))

import RecipeEvolutionTree from '../components/recipes/RecipeEvolutionTree'

// Oma → Mama and Tante both fork Oma; Emma forks Mama.
const versions = [
  { id: 'oma', parentId: null, year: 1978, title: 'Oma' },
  { id: 'tante', parentId: 'oma', year: 2010, title: 'Tante' },
  { id: 'mama', parentId: 'oma', year: 2005, title: 'Mama' },
  { id: 'emma', parentId: 'mama', year: 2024, title: 'Emma' },
]

describe('buildLineageTree', () => {
  it('branches by parent and orders siblings by year', () => {
    const tree = buildLineageTree(versions)
    expect(tree.version.id).toBe('oma')
    expect(tree.children.map((c) => c.version.id)).toEqual(['mama', 'tante'])
    expect(tree.children[0].children.map((c) => c.version.id)).toEqual(['emma'])
    expect(tree.children[0].children[0].parent.id).toBe('mama')
  })

  it('hangs a version whose parent was deleted off the root', () => {
    const tree = buildLineageTree([versions[0], { id: 'lost', parentId: 'gone', year: 2000, title: 'Lost' }])
    expect(tree.children.map((c) => c.version.id)).toEqual(['lost'])
  })

  it('returns nothing for no versions', () => {
    expect(buildLineageTree([])).toBeNull()
  })

  it('finds the newest version', () => {
    expect(newestVersion(versions).id).toBe('emma')
  })
})

describe('RecipeEvolutionTree', () => {
  it('shows every version and reports the one that is clicked', () => {
    const onVersionClick = vi.fn()
    render(<RecipeEvolutionTree versions={versions} onVersionClick={onVersionClick} />)

    // The wide and the narrow layout are both in the DOM; CSS picks one.
    expect(screen.getAllByText('Emma')).toHaveLength(2)
    expect(screen.getAllByText('tree.current')).toHaveLength(2)

    fireEvent.click(screen.getAllByText('Tante')[0])
    expect(onVersionClick).toHaveBeenCalledWith(versions[1])
  })
})

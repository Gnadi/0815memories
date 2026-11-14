/* A recipe's instructions between the form and the stored fields: what a fork
   or an edit starts from, and what a save writes. */
import { describe, it, expect } from 'vitest'
import { instructionsFromRecipe, instructionsToFields } from '../utils/recipeInstructions'

const rich = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Knead' }] }] }

describe('instructionsFromRecipe', () => {
  it('opens Markdown in Markdown', () => {
    expect(instructionsFromRecipe({ instructionsFormat: 'markdown', instructions: '1. **Mix**' }))
      .toEqual({ format: 'markdown', rich: null, markdown: '1. **Mix**' })
  })

  it('opens the rich document in the editor', () => {
    expect(instructionsFromRecipe({ instructionsFormat: 'rich', instructions: 'Knead', instructionsRich: rich }))
      .toEqual({ format: 'rich', rich, markdown: '' })
  })

  it('carries the plain text of an older recipe, or of a document that did not decrypt, into the editor', () => {
    const expected = { type: 'doc', content: [{ type: 'paragraph', content: [
      { type: 'text', text: 'Peel' }, { type: 'hardBreak' }, { type: 'text', text: 'Bake' },
    ] }] }
    expect(instructionsFromRecipe({ instructions: 'Peel\nBake' }).rich).toEqual(expected)
    expect(instructionsFromRecipe({ instructionsFormat: 'rich', instructions: 'Peel\nBake', instructionsRich: 'ciphertext' }).rich)
      .toEqual(expected)
  })

  it('starts empty for a recipe without instructions', () => {
    expect(instructionsFromRecipe({ instructions: '' })).toEqual({ format: 'rich', rich: null, markdown: '' })
  })
})

describe('instructionsToFields', () => {
  it('stores Markdown as its source, without a document', () => {
    expect(instructionsToFields({ format: 'markdown', rich: rich, markdown: ' 1. Mix \n' }))
      .toEqual({ instructionsFormat: 'markdown', instructions: '1. Mix', instructionsRich: null })
  })

  it('stores the document with a plain-text mirror', () => {
    expect(instructionsToFields({ format: 'rich', rich, markdown: '' }))
      .toEqual({ instructionsFormat: 'rich', instructions: 'Knead', instructionsRich: rich })
  })

  it('stores no document for an empty editor', () => {
    expect(instructionsToFields({ format: 'rich', rich: { type: 'doc', content: [{ type: 'paragraph' }] }, markdown: '' }))
      .toEqual({ instructionsFormat: 'rich', instructions: '', instructionsRich: null })
  })
})

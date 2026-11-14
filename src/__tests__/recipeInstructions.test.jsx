/* A recipe's instructions: written in the rich editor by default or in
   Markdown on request, switched without losing the text, and read back in
   whichever format they were written in. */
import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// The editor itself is TipTap's and has tests of its own; here it only has to
// show what it was given and hand back a document.
vi.mock('../components/admin/RichTextEditorLazy', () => ({
  default: ({ value, onChange, media }) => (
    <div data-testid="rich-editor" data-media={String(media)}>
      <span>{JSON.stringify(value)}</span>
      <button
        type="button"
        onClick={() => onChange({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bake', marks: [{ type: 'bold' }] }] }] })}
      >
        type
      </button>
    </div>
  ),
}))

const RecipeInstructionsField = (await import('../components/recipes/RecipeInstructionsField')).default
const RecipeInstructions = (await import('../components/recipes/RecipeInstructions')).default

function Field({ initial = { format: 'rich', rich: null, markdown: '' }, onValue = () => {} }) {
  const [value, setValue] = useState(initial)
  return <RecipeInstructionsField value={value} onChange={(next) => { setValue(next); onValue(next) }} />
}

describe('RecipeInstructionsField', () => {
  it('starts in the rich editor, without media', () => {
    render(<Field />)
    expect(screen.getByRole('radio', { name: 'Editor' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('rich-editor')).toHaveAttribute('data-media', 'false')
  })

  it('carries the text over to Markdown and back', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Field onValue={onValue} />)

    await user.click(screen.getByRole('button', { name: 'type' }))
    await user.click(screen.getByRole('radio', { name: 'Markdown' }))
    expect(screen.getByRole('textbox')).toHaveValue('**Bake**')

    await user.type(screen.getByRole('textbox'), ' _now_')
    await user.click(screen.getByRole('radio', { name: 'Editor' }))
    expect(onValue).toHaveBeenLastCalledWith(expect.objectContaining({
      format: 'rich',
      rich: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [
          { type: 'text', text: 'Bake', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' ' },
          { type: 'text', text: 'now', marks: [{ type: 'italic' }] },
        ] }],
      },
    }))
  })

  it('previews the Markdown', async () => {
    const user = userEvent.setup()
    render(<Field initial={{ format: 'markdown', rich: null, markdown: '## Dough\n\n1. Knead' }} />)
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    expect(screen.getByRole('heading', { name: 'Dough' })).toBeInTheDocument()
    expect(screen.getByRole('listitem')).toHaveTextContent('Knead')
  })
})

describe('RecipeInstructions', () => {
  it('reads Markdown', () => {
    render(<RecipeInstructions recipe={{ instructionsFormat: 'markdown', instructions: '**Hot** oven\n\n- [link](javascript:alert(1))' }} />)
    expect(screen.getByText('Hot').tagName).toBe('STRONG')
    // RichContent's protocol allowlist holds for Markdown links too.
    expect(screen.getByText('link').closest('a')).toBeNull()
  })

  it('reads the rich document', () => {
    const rich = { type: 'doc', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Filling' }] }] }
    render(<RecipeInstructions recipe={{ instructionsFormat: 'rich', instructions: 'Filling', instructionsRich: rich }} />)
    expect(screen.getByRole('heading', { name: 'Filling' })).toBeInTheDocument()
  })

  it('falls back to the plain text of a recipe from before, or a document that did not decrypt', () => {
    const { container, rerender } = render(<RecipeInstructions recipe={{ instructions: '**not markdown**' }} />)
    expect(container).toHaveTextContent('**not markdown**')
    rerender(<RecipeInstructions recipe={{ instructionsFormat: 'rich', instructions: 'Mirror', instructionsRich: 'ciphertext' }} />)
    expect(container).toHaveTextContent('Mirror')
  })
})

/**
 * A recipe's instructions between the form and the stored fields (see
 * INSTRUCTION_FORMATS in src/services/recipes.js).
 *
 * The form holds { format, rich, markdown }; the recipe holds
 * instructionsFormat, instructions and instructionsRich.
 */
import { isRichDoc, plainTextToRich, richDocIsEmpty, richToPlainText } from './richText'

export const EMPTY_INSTRUCTIONS = { format: 'rich', rich: null, markdown: '' }

/**
 * The form's value for a stored recipe — to fork it or to edit it. A recipe
 * from before either editor opens in the rich editor, its plain text carried
 * over line by line, and so does a rich one whose document did not decrypt.
 */
export function instructionsFromRecipe(recipe) {
  const text = recipe?.instructions || ''
  if (recipe?.instructionsFormat === 'markdown') return { format: 'markdown', rich: null, markdown: text }
  if (recipe?.instructionsFormat === 'rich' && isRichDoc(recipe.instructionsRich)) {
    return { format: 'rich', rich: recipe.instructionsRich, markdown: '' }
  }
  return { format: 'rich', rich: text.trim() ? plainTextToRich(text) : null, markdown: '' }
}

/**
 * The stored fields for the form's value. A rich recipe keeps a plain-text
 * mirror in `instructions`; a Markdown one, its source. `instructionsRich` is
 * null when there is no document, which an edit turns into a deleted field.
 */
export function instructionsToFields({ format, rich, markdown }) {
  if (format === 'markdown') {
    return { instructionsFormat: 'markdown', instructions: markdown.trim(), instructionsRich: null }
  }
  const hasDoc = !richDocIsEmpty(rich)
  return {
    instructionsFormat: 'rich',
    instructions: hasDoc ? richToPlainText(rich) : '',
    instructionsRich: hasDoc ? rich : null,
  }
}

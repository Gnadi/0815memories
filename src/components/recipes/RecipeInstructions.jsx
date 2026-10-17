import { useMemo } from 'react'
import RichContent from '../memory/RichContent'
import { markdownToRich } from '../../utils/markdown'
import { isRichDoc } from '../../utils/richText'

/**
 * The instructions as written: Markdown, the rich editor's document, or the
 * plain text of a recipe from before either (see INSTRUCTION_FORMATS in
 * src/services/recipes.js).
 *
 * A rich recipe whose document did not decrypt or parse falls back to its
 * plain-text mirror rather than showing nothing.
 */
export default function RecipeInstructions({ recipe }) {
  const { instructionsFormat, instructions, instructionsRich } = recipe
  const doc = useMemo(() => {
    if (instructionsFormat === 'markdown') return markdownToRich(instructions)
    if (instructionsFormat === 'rich' && isRichDoc(instructionsRich)) return instructionsRich
    return null
  }, [instructionsFormat, instructions, instructionsRich])

  if (doc) return <RichContent doc={doc} compact />
  return <p className="text-sm text-bark leading-relaxed whitespace-pre-wrap">{instructions}</p>
}

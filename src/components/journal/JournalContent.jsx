import { useMemo } from 'react'
import RichContent from '../memory/RichContent'
import { entryDoc } from '../../utils/journalContent'

/**
 * An entry's text as it was written: Markdown, the rich editor's document, or
 * the plain text of an entry from before either (see CONTENT_FORMATS in
 * src/services/journals.js).
 */
export default function JournalContent({ entry }) {
  const doc = useMemo(() => entryDoc(entry), [entry])

  if (doc) return <RichContent doc={doc} />
  return <p className="leading-relaxed whitespace-pre-wrap">{entry.content}</p>
}

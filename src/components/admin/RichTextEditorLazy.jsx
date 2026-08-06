import { lazy, Suspense } from 'react'

/**
 * Split boundary for the rich description editor.
 *
 * PostMemoryModal is imported statically by HomePage and MemoryDetailPage, so
 * TipTap has to be split one level below it or it would ride along in both page
 * chunks. That is not a nicety here: vite.config.js turns off modulePreload
 * specifically to protect first paint, and the editor is by far the largest
 * dependency in the app.
 *
 * Import this file, never RichTextEditor directly.
 */
const RichTextEditor = lazy(() => import('./RichTextEditor'))

function EditorSkeleton() {
  // Matches the editor's footprint so the modal does not jump when it arrives.
  return <div className="min-h-[248px] rounded-xl bg-cream-dark animate-pulse" />
}

export default function RichTextEditorLazy(props) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <RichTextEditor {...props} />
    </Suspense>
  )
}

export { EditorSkeleton }

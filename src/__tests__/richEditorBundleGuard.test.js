/**
 * TipTap must stay off the read path.
 *
 * vite.config.js disables modulePreload specifically to protect first paint, and
 * the editor is the largest dependency in the app. It is reachable only through
 * RichTextEditorLazy; anything that imports @tiptap directly would pull it into
 * the HomePage and MemoryDetailPage chunks, which both import PostMemoryModal
 * statically.
 *
 * A source-level check rather than a bundle-size assertion: it costs nothing and
 * fails on the actual mistake — an import in the wrong file.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const TIPTAP = /@tiptap/

// Files that must never reach for the editor.
const READ_PATH = [
  'src/components/admin/PostMemoryModal.jsx',
  'src/components/memory/MemoryBody.jsx',
  'src/components/memory/RichContent.jsx',
  'src/components/memory/VoiceMemoPlayer.jsx',
  'src/utils/richText.js',
  'src/utils/nasExport.js',
  'src/hooks/useMemories.js',
  'src/pages/MemoryDetailPage.jsx',
  'src/pages/HomePage.jsx',
]

describe('rich editor bundle boundary', () => {
  it.each(READ_PATH)('%s does not import @tiptap', (file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(TIPTAP)
  })

  it('RichTextEditorLazy reaches the editor only through a dynamic import', () => {
    const src = readFileSync('src/components/admin/RichTextEditorLazy.jsx', 'utf8')
    expect(src).toMatch(/lazy\(\s*\(\)\s*=>\s*import\('\.\/RichTextEditor'\)\s*\)/)
    expect(src).not.toMatch(TIPTAP)
  })

  it('the editor itself is allowed to import @tiptap', () => {
    // Guards against the guard passing because the file was renamed away.
    expect(readFileSync('src/components/admin/RichTextEditor.jsx', 'utf8')).toMatch(TIPTAP)
  })
})

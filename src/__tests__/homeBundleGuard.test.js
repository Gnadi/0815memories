/**
 * The writing forms stay out of the home page's chunk: they are admin-only and
 * open on a tap, and a static import put them — drag and drop and the voice
 * recorder included — in front of every member's feed. A source-level check,
 * like richEditorBundleGuard.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('home page chunk', () => {
  const src = readFileSync('src/pages/HomePage.jsx', 'utf8')

  it('does not import the writing forms statically', () => {
    expect(src).not.toMatch(/^import[^\n]*from\s+'\.\.\/components\/admin\/PostEntryModal'/m)
  })

  it('loads them through a dynamic import', () => {
    expect(src).toMatch(/import\('\.\.\/components\/admin\/PostEntryModal'\)/)
  })
})

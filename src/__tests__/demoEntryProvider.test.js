/* /demo only sets the demo flag and reloads into the demo, so it does not wait
   for Firebase first (context/AuthContext.jsx needsProvider). */
import { describe, it, expect } from 'vitest'
import { needsProvider } from '../context/AuthContext'

describe('needsProvider', () => {
  it('leaves /demo and the pre-rendered pages without Firebase', () => {
    expect(needsProvider('/demo')).toBe(false)
    expect(needsProvider('/')).toBe(false)
  })

  it('loads it everywhere the app runs', () => {
    for (const path of ['/home', '/login', '/memory/abc', '/demo/x']) expect(needsProvider(path)).toBe(true)
  })
})

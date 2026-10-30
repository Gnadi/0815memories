/**
 * Firebase must stay out of the startup bundle.
 *
 * Auth, Firestore and Functions were about two thirds of the JavaScript a
 * visitor downloaded before the landing page painted, for a page that needs
 * none of them while nobody is signed in. They now load with AuthProviderImpl
 * (context/AuthContext.jsx) and with the pages that use them.
 *
 * A source-level check, like richEditorBundleGuard: it fails on the actual
 * mistake, a static import in a file the startup bundle contains.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Files the shell and the pre-rendered pages import statically.
const STARTUP = [
  'src/main.jsx',
  'src/App.jsx',
  'src/context/AuthContext.jsx',
  'src/pages/LandingPage.jsx',
  'src/components/layout/ProtectedRoute.jsx',
  'src/components/PWAInstallPrompt.jsx',
]

const FIREBASE_STATIC = /^import[^\n]*from\s+'(firebase\/|(\.\.?\/)+config\/firebase|(\.\.?\/)+config\/firestore|(\.\.?\/)+services\/|(\.\.?\/)+utils\/notifications|(\.\.?\/)+context\/AuthProviderImpl)/m

describe('startup bundle boundary', () => {
  it.each(STARTUP)('%s does not import Firebase statically', (file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(FIREBASE_STATIC)
  })

  it('the provider is reached only through a dynamic import', () => {
    const src = readFileSync('src/context/AuthContext.jsx', 'utf8')
    expect(src).toMatch(/import\('\.\/AuthProviderImpl'\)/)
  })

  it('the pages that talk to Firebase are lazy in the route table', () => {
    const src = readFileSync('src/App.jsx', 'utf8')
    for (const page of ['LoginPage', 'SignupPage', 'InviteRedeemPage', 'AdminMobileBottomNav']) {
      expect(src).toMatch(new RegExp(`const ${page} = lazy\\(`))
    }
  })

  it('the implementation itself is allowed to import Firebase', () => {
    // Guards against the guard passing because the file was renamed away.
    expect(readFileSync('src/context/AuthProviderImpl.jsx', 'utf8')).toMatch(/from 'firebase\/auth'/)
  })
})

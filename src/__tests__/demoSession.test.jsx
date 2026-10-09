/**
 * A demo tab's session (src/demo/).
 *
 * In a tab flagged for the demo, AuthContext must sign in the demo family's
 * made-up admin without touching Firebase Auth, put the demo database behind
 * every query before anything queries, and leave the stored session alone:
 * it belongs to whoever is signed in outside the demo, perhaps in another tab
 * of this very browser.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// The flag is read once, when the modules load — as it is on a page load.
window.sessionStorage.setItem('kaydo_demo', '1')
window.localStorage.setItem('fh_familyId', 'someone-real')
window.localStorage.setItem('fh_cardStyle', 'polaroid')

const onAuthStateChanged = vi.fn(() => () => {})
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  connectAuthEmulator: vi.fn(),
  onAuthStateChanged: (...args) => onAuthStateChanged(...args),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signInWithCustomToken: vi.fn(),
  updateProfile: vi.fn(),
  signOut: vi.fn(),
  setPersistence: vi.fn(() => Promise.resolve()),
  browserLocalPersistence: 'local',
  browserSessionPersistence: 'session',
}))

// Leaving is a hard navigation, which jsdom cannot make.
vi.mock('../demo/demoMode', async (importOriginal) => ({
  ...(await importOriginal()),
  exitDemo: vi.fn(),
}))

const { AuthProvider, useAuth } = await import('../context/AuthContext')
const { useMemories } = await import('../hooks/useMemories')
const { exitDemo } = await import('../demo/demoMode')
const { db } = await import('../config/firebase')

function Probe() {
  const { user, isAdmin, isDemo, familyId, loading, keyLoading, encryptionKey, logout } = useAuth()
  const { memories } = useMemories(loading ? null : familyId, encryptionKey)
  return (
    <ul>
      <li>user:{user?.uid ?? 'none'}</li>
      <li>isAdmin:{String(isAdmin)}</li>
      <li>isDemo:{String(isDemo)}</li>
      <li>familyId:{String(familyId)}</li>
      <li>keyLoading:{String(keyLoading)}</li>
      <li>memories:{memories.length}</li>
      <li>first:{memories[0]?.title ?? ''}</li>
      <li><button onClick={logout}>leave</button></li>
    </ul>
  )
}

describe('a demo tab', () => {
  it('signs in the demo family, from the demo database, without Firebase', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    expect(await screen.findByText('familyId:demo-family')).toBeInTheDocument()
    expect(screen.getByText('user:demo-visitor')).toBeInTheDocument()
    expect(screen.getByText('isAdmin:true')).toBeInTheDocument()
    expect(screen.getByText('isDemo:true')).toBeInTheDocument()
    // No key in the demo family: the gate opens on the plaintext answer.
    expect(await screen.findByText('keyLoading:false')).toBeInTheDocument()
    expect(await screen.findByText('memories:9')).toBeInTheDocument()
    expect(screen.getByText('first:The treehouse is finished')).toBeInTheDocument()

    // Firebase was never started, let alone asked who is signed in.
    expect(db).toEqual({ type: 'demo' })
    expect(onAuthStateChanged).not.toHaveBeenCalled()
  })

  it('leaves the stored session as it found it', () => {
    expect(window.localStorage.getItem('fh_familyId')).toBe('someone-real')
    expect(window.localStorage.getItem('fh_cardStyle')).toBe('polaroid')
  })

  it('logs out by leaving the demo', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await screen.findByText('familyId:demo-family')
    fireEvent.click(screen.getByRole('button', { name: 'leave' }))
    expect(exitDemo).toHaveBeenCalledWith('/')
  })
})

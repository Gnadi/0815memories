import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * The home page's suggestion to an admin of a family photo for the login
 * page. Admins could always upload one in the settings, but nothing said so,
 * and every family member's first sight of Kaydo stayed the illustration.
 */

const auth = vi.hoisted(() => ({ isAdmin: true, familyId: 'fam1', isDemo: false }))
const family = vi.hoisted(() => ({ current: {} }))

vi.mock('../config/firebase', () => ({ db: { type: 'test' } }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../services/family', () => ({
  subscribeFamily: (familyId, onData) => {
    onData(family.current)
    return () => {}
  },
}))

import LoginPhotoHint from '../components/home/LoginPhotoHint'

const renderHint = () => render(<MemoryRouter><LoginPhotoHint /></MemoryRouter>)
const TITLE = 'Give your login page a face'

describe('the login photo hint', () => {
  beforeEach(() => {
    window.localStorage.clear()
    Object.assign(auth, { isAdmin: true, familyId: 'fam1', isDemo: false })
    family.current = { familyName: 'The Millers', loginPageMode: 'classic' }
  })

  it('suggests a photo to an admin whose login page shows the illustration', () => {
    renderHint()
    expect(screen.getByRole('heading', { name: TITLE })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Choose a photo' })).toHaveAttribute('href', '/settings#login-image')
  })

  it.each([
    ['a photo of its own', { loginHeaderImage: 'https://example.com/us.jpg' }],
    ['a theme', { loginPageMode: 'theme' }],
    ['a design of its own', { loginPageMode: 'custom' }],
  ])('says nothing to a family with %s', (_, fields) => {
    family.current = { ...family.current, ...fields }
    renderHint()
    expect(screen.queryByRole('heading', { name: TITLE })).toBeNull()
  })

  it('says nothing to a family member who is not an admin', () => {
    auth.isAdmin = false
    renderHint()
    expect(screen.queryByRole('heading', { name: TITLE })).toBeNull()
  })

  it('says nothing in the demo, whose home page the landing screenshots show', () => {
    auth.isDemo = true
    renderHint()
    expect(screen.queryByRole('heading', { name: TITLE })).toBeNull()
  })

  it('goes on "Not now" and stays away from this device for a month', () => {
    const { unmount } = renderHint()
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByRole('heading', { name: TITLE })).toBeNull()
    unmount()

    renderHint()
    expect(screen.queryByRole('heading', { name: TITLE })).toBeNull()

    const until = Number(window.localStorage.getItem('kaydo_login_photo_hint:fam1'))
    expect(until - Date.now()).toBeGreaterThan(29 * 24 * 60 * 60 * 1000)
  })

  it('comes back once the month is over', () => {
    window.localStorage.setItem('kaydo_login_photo_hint:fam1', String(Date.now() - 1000))
    renderHint()
    expect(screen.getByRole('heading', { name: TITLE })).toBeInTheDocument()
  })
})

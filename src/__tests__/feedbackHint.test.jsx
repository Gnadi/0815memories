import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

/**
 * The home page's question for feedback. The form was only reachable through
 * a small entry in the sidebar and the header; this card asks, and an answer
 * keeps it away from the device for a while.
 */

const auth = vi.hoisted(() => ({ isDemo: false }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../components/FeedbackModal', () => ({
  default: ({ onClose, onSent }) => (
    <div role="dialog">
      <button type="button" onClick={onSent}>send</button>
      <button type="button" onClick={onClose}>close</button>
    </div>
  ),
}))

import FeedbackHint from '../components/home/FeedbackHint'
import { FEEDBACK_HINT_SNOOZE_MS, FEEDBACK_HINT_THANKS_MS } from '../hooks/useFeedbackHint'

const renderHint = () => render(<MemoryRouter><FeedbackHint /></MemoryRouter>)
const TITLE = 'How do you like Kaydo?'
const DAY = 24 * 60 * 60 * 1000
const hiddenFor = () => Number(window.localStorage.getItem('kaydo_feedback_hint')) - Date.now()

describe('the feedback hint', () => {
  beforeEach(() => {
    window.localStorage.clear()
    auth.isDemo = false
  })

  it('asks for feedback and opens the form on a tap', async () => {
    renderHint()
    expect(screen.getByRole('heading', { name: TITLE })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Give feedback' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('says nothing in the demo, where feedback would go nowhere', () => {
    auth.isDemo = true
    renderHint()
    expect(screen.queryByRole('heading', { name: TITLE })).toBeNull()
  })

  it('goes on "Not now" for about two months', () => {
    renderHint()
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(screen.queryByRole('heading', { name: TITLE })).toBeNull()
    expect(hiddenFor()).toBeGreaterThan(FEEDBACK_HINT_SNOOZE_MS - DAY)
  })

  it('goes for half a year once feedback is sent, after the form closes', async () => {
    renderHint()
    fireEvent.click(screen.getByRole('button', { name: 'Give feedback' }))
    fireEvent.click(await screen.findByRole('button', { name: 'send' }))
    expect(hiddenFor()).toBeGreaterThan(FEEDBACK_HINT_THANKS_MS - DAY)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    expect(screen.queryByRole('heading', { name: TITLE })).toBeNull()
  })

  it('stays away while hidden and comes back afterwards', () => {
    window.localStorage.setItem('kaydo_feedback_hint', String(Date.now() + DAY))
    const { unmount } = renderHint()
    expect(screen.queryByRole('heading', { name: TITLE })).toBeNull()
    unmount()
    window.localStorage.setItem('kaydo_feedback_hint', String(Date.now() - 1000))
    renderHint()
    expect(screen.getByRole('heading', { name: TITLE })).toBeInTheDocument()
  })
})

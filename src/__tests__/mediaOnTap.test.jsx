/* Videos and voice memos on a page are fetched and decrypted when they are
   played, not when the page opens: an encrypted file cannot stream, so each
   used to be downloaded whole on arrival, alongside the page's photos. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const asked = vi.hoisted(() => [])
vi.mock('../components/media/useDecryptedMedia', () => ({
  default: (src) => {
    asked.push(src)
    return { decryptedUrl: null, loading: true, error: null, ref: () => {} }
  },
}))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ encryptionKey: {}, keyLoading: false }) }))

import VideoOnTap from '../components/media/VideoOnTap'
import { SingleMemoPlayer } from '../components/memory/VoiceMemoPlayer'

beforeEach(() => {
  asked.length = 0
})

describe('VideoOnTap', () => {
  it('fetches nothing until it is played', () => {
    render(<VideoOnTap src="https://cdn/clip.enc" title="Swimming" />)
    expect(asked).not.toContain('https://cdn/clip.enc')

    fireEvent.click(screen.getByRole('button', { name: 'Swimming' }))
    expect(asked).toContain('https://cdn/clip.enc')
    expect(document.querySelector('video')).toHaveAttribute('autoplay')
  })

  it('shows its poster, and says what the button does when the clip has no title', () => {
    render(<VideoOnTap src="https://cdn/clip.enc" poster="https://cdn/poster.enc" />)
    expect(asked).toEqual(['https://cdn/poster.enc'])
    expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument()
  })
})

describe('SingleMemoPlayer', () => {
  it('fetches the recording on the first tap, and shows its stored length before', () => {
    render(<SingleMemoPlayer memo={{ url: 'https://cdn/memo.enc', duration: 65 }} />)
    expect(asked).toEqual([])
    expect(screen.getByText('01:05')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button'))
    expect(asked).toContain('https://cdn/memo.enc')
    expect(document.querySelector('audio')).toHaveAttribute('autoplay')
  })
})

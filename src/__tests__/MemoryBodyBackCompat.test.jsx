/**
 * The rich description must never cost an existing memory its story.
 *
 * `contentRich` reaches MemoryBody in three shapes and only one of them renders
 * rich: a parsed document. A still-encrypted string (the feed listener leaves it
 * that way on purpose) and a missing field both have to fall back to the
 * plain-text `content` mirror.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MemoryBody from '../components/memory/MemoryBody'

vi.mock('../components/media/EncryptedImage', () => ({
  default: ({ src, alt }) => <img data-testid="enc-image" src={src} alt={alt} />,
}))
vi.mock('../components/media/EncryptedVideo', () => ({ default: () => null }))
vi.mock('../components/memory/VoiceMemoPlayer', () => ({
  default: () => null,
  SingleMemoPlayer: () => null,
}))
vi.mock('../components/memory/MemoryVideoPlayer', () => ({ default: () => null }))

const RICH = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Der Sommer' }] },
    { type: 'encryptedImage', attrs: { src: 'https://x/a', caption: 'Am See' } },
  ],
}

const base = { title: 'Sommer bei Oma', content: 'Erster Absatz\n\nZweiter Absatz' }

describe('MemoryBody description fallback', () => {
  it('renders the legacy plain text when there is no contentRich', () => {
    render(<MemoryBody memory={base} />)
    expect(screen.getByText('Erster Absatz')).toBeInTheDocument()
    expect(screen.getByText('Zweiter Absatz')).toBeInTheDocument()
  })

  it('keeps single newlines visible, which the old renderer dropped', () => {
    render(<MemoryBody memory={{ ...base, content: 'Zeile eins\nZeile zwei' }} />)
    const p = screen.getByText(/Zeile eins/)
    expect(p).toHaveClass('whitespace-pre-wrap')
    expect(p.textContent).toBe('Zeile eins\nZeile zwei')
  })

  it('renders the rich document when contentRich is parsed', () => {
    render(<MemoryBody memory={{ ...base, contentRich: RICH }} />)
    expect(screen.getByText('Der Sommer').tagName).toBe('H2')
    expect(screen.getByTestId('enc-image')).toHaveAttribute('src', 'https://x/a')
    // The mirror must not be rendered a second time alongside it.
    expect(screen.queryByText('Erster Absatz')).toBeNull()
  })

  it('falls back to the mirror when contentRich is still ciphertext', () => {
    render(<MemoryBody memory={{ ...base, contentRich: 'kJ8xQ2hjaXBoZXJ0ZXh0' }} />)
    expect(screen.getByText('Erster Absatz')).toBeInTheDocument()
    expect(screen.queryByTestId('enc-image')).toBeNull()
  })

  it('falls back when contentRich is an unparsed JSON string', () => {
    render(<MemoryBody memory={{ ...base, contentRich: JSON.stringify(RICH) }} />)
    expect(screen.getByText('Erster Absatz')).toBeInTheDocument()
    expect(screen.queryByTestId('enc-image')).toBeNull()
  })

  it('still renders the title and the separate media sections', () => {
    render(<MemoryBody memory={{ ...base, contentRich: RICH, authorName: 'Papa' }} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sommer bei Oma')
    expect(screen.getByText('Papa')).toBeInTheDocument()
  })
})

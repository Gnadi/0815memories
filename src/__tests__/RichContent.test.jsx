import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import RichContent from '../components/memory/RichContent'

// The real components decrypt through useDecryptedMedia, which needs workers,
// AuthContext and firebase. The renderer's job is only to pick the right
// component and hand it the right src.
vi.mock('../components/media/EncryptedImage', () => ({
  default: ({ src, alt }) => <img data-testid="enc-image" src={src} alt={alt} />,
}))
vi.mock('../components/media/EncryptedVideo', () => ({
  default: ({ src }) => <video data-testid="enc-video" src={src} />,
}))
vi.mock('../components/memory/VoiceMemoPlayer', () => ({
  default: () => null,
  SingleMemoPlayer: ({ memo }) => <div data-testid="enc-audio" data-src={memo.url} />,
}))

const doc = (...content) => ({ type: 'doc', content })
const para = (...content) => ({ type: 'paragraph', content })
const text = (value, marks) => ({ type: 'text', text: value, ...(marks ? { marks } : {}) })

describe('RichContent', () => {
  it('renders nothing for anything that is not a parsed document', () => {
    const { container } = render(<RichContent doc="ciphertext" />)
    expect(container).toBeEmptyDOMElement()
    expect(render(<RichContent doc={undefined} />).container).toBeEmptyDOMElement()
  })

  it('renders paragraphs and inline marks', () => {
    render(<RichContent doc={doc(para(text('ganz '), text('wichtig', [{ type: 'bold' }])))} />)
    expect(screen.getByText('wichtig').tagName).toBe('STRONG')
    expect(screen.getByText(/ganz/)).toBeInTheDocument()
  })

  it('starts headings at h2, because the memory title owns the only h1', () => {
    render(
      <RichContent
        doc={doc(
          { type: 'heading', attrs: { level: 1 }, content: [text('Eins')] },
          { type: 'heading', attrs: { level: 3 }, content: [text('Drei')] }
        )}
      />
    )
    expect(screen.getByText('Eins').tagName).toBe('H2')
    expect(screen.getByText('Drei').tagName).toBe('H3')
  })

  it('renders lists', () => {
    render(
      <RichContent
        doc={doc({
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [para(text('Eis'))] },
            { type: 'listItem', content: [para(text('Sonne'))] },
          ],
        })}
      />
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('renders a safe link', () => {
    render(
      <RichContent
        doc={doc(para(text('Kaydo', [{ type: 'link', attrs: { href: 'https://kaydo.app' } }])))}
      />
    )
    const link = screen.getByRole('link', { name: 'Kaydo' })
    expect(link).toHaveAttribute('href', 'https://kaydo.app')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('strips a javascript: href and keeps only the text', () => {
    render(
      <RichContent
        doc={doc(para(text('klick', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }])))}
      />
    )
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('klick')).toBeInTheDocument()
  })

  it('strips a data: href too', () => {
    render(
      <RichContent
        doc={doc(
          para(text('x', [{ type: 'link', attrs: { href: 'data:text/html,<script>' } }]))
        )}
      />
    )
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('renders an inline image with its caption', () => {
    render(
      <RichContent
        doc={doc({
          type: 'encryptedImage',
          attrs: { src: 'https://x/a', caption: 'Oma am See' },
        })}
      />
    )
    expect(screen.getByTestId('enc-image')).toHaveAttribute('src', 'https://x/a')
    expect(screen.getByText('Oma am See')).toBeInTheDocument()
  })

  it('shows a poster for an inline video instead of decrypting it on mount', () => {
    render(
      <RichContent doc={doc({ type: 'encryptedVideo', attrs: { src: 'https://x/b' } })} />
    )
    // No <video> until the reader asks for it — five inline clips would
    // otherwise all hit the decrypt pool at once.
    expect(screen.queryByTestId('enc-video')).toBeNull()
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('mounts the video after the poster is clicked', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    render(
      <RichContent doc={doc({ type: 'encryptedVideo', attrs: { src: 'https://x/b' } })} />
    )
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByTestId('enc-video')).toHaveAttribute('src', 'https://x/b')
  })

  it('renders inline audio through the shared memo player', () => {
    render(
      <RichContent
        doc={doc({ type: 'encryptedAudio', attrs: { src: 'https://x/c', title: 'Opa' } })}
      />
    )
    expect(screen.getByTestId('enc-audio')).toHaveAttribute('data-src', 'https://x/c')
  })

  it('skips media whose upload never finished', () => {
    render(<RichContent doc={doc({ type: 'encryptedImage', attrs: { src: '' } })} />)
    expect(screen.queryByTestId('enc-image')).toBeNull()
  })

  it('ignores unknown node types so a newer document stays readable', () => {
    render(<RichContent doc={doc({ type: 'somethingNew' }, para(text('bleibt')))} />)
    expect(screen.getByText('bleibt')).toBeInTheDocument()
  })
})

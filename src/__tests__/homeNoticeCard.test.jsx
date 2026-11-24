import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HomeNoticeCard from '../components/home/HomeNoticeCard'

/**
 * The home page's notice card, which the advent calendar and the login photo
 * hint share: a titled section whose link leads on, with a dismiss button
 * only when there is something to dismiss.
 */

const renderCard = (props = {}) => render(
  <MemoryRouter>
    <HomeNoticeCard
      to="/somewhere"
      eyebrow="Eyebrow"
      title="A title"
      body="Some text."
      cta="Go there"
      icon={<span>★</span>}
      {...props}
    />
  </MemoryRouter>,
)

describe('the home notice card', () => {
  it('is a section named by its title, with a link to its target', () => {
    renderCard()
    expect(screen.getByRole('region', { name: 'A title' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go there' })).toHaveAttribute('href', '/somewhere')
    expect(screen.getByText('Eyebrow')).toBeInTheDocument()
    expect(screen.getByText('Some text.')).toBeInTheDocument()
  })

  it('wears the background it is given', () => {
    renderCard({ background: 'advent' })
    expect(screen.getByRole('region').className).toContain('home-notice--advent')
  })

  it('has no dismiss button unless it can be dismissed', () => {
    renderCard()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('calls onDismiss from its dismiss button', () => {
    const onDismiss = vi.fn()
    renderCard({ onDismiss, dismissLabel: 'Not now' })
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('shows a picture behind the text when given one', () => {
    const { container } = renderCard({ image: '/picture.webp' })
    expect(container.querySelector('img')).toHaveAttribute('src', '/picture.webp')
  })
})

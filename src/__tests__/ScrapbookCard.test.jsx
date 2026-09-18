import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../components/media/EncryptedImage', () => ({ default: () => null }))

const ScrapbookCard = (await import('../components/scrapbook/ScrapbookCard')).default

describe('ScrapbookCard', () => {
  // The overview loads scrapbooks without decrypting `pages`, so the ciphertext
  // string sits where the array used to — counting it once claimed a four-page
  // book had a thousand pages.
  it('reports the stored page count, not the length of the encrypted pages blob', () => {
    render(
      <ScrapbookCard
        scrapbook={{ id: 'a', title: 'Summer', pageCount: 4, pages: 'x'.repeat(1000) }}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText('4 pages')).toBeInTheDocument()
    expect(screen.queryByText(/1000/)).not.toBeInTheDocument()
  })

  it('counts a decrypted page array when no stored count is present', () => {
    render(
      <ScrapbookCard
        scrapbook={{ id: 'b', title: 'Trip', pages: [{ id: '1' }] }}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText('1 page')).toBeInTheDocument()
  })

  it('shows no count for a book that has neither', () => {
    render(
      <ScrapbookCard
        scrapbook={{ id: 'c', title: 'Old', pages: 'x'.repeat(1000) }}
        onDelete={vi.fn()}
      />
    )
    expect(screen.getByText('Old')).toBeInTheDocument()
    expect(screen.queryByText(/page/i)).not.toBeInTheDocument()
  })
})

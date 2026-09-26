/**
 * Ordering a printed scrapbook — PrintOrderModal.
 *
 * The dialog must say the print file is unencrypted before it makes one, ask
 * for a checkout for exactly the file it uploaded, and stop rendering and
 * uploading the moment the admin walks away.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../utils/printUpload', () => ({ uploadPrintFile: vi.fn() }))
vi.mock('../utils/printCheckout', () => ({ createPrintCheckout: vi.fn() }))

const { uploadPrintFile } = await import('../utils/printUpload')
const { createPrintCheckout } = await import('../utils/printCheckout')
const PrintOrderModal = (await import('../components/scrapbook/PrintOrderModal')).default

const pages = (n) => Array.from({ length: n }, (_, index) => ({ kind: 'page', index }))
const sheets = [...pages(2), { kind: 'blank', color: '#FFFFFF' }, { kind: 'back', color: '#2D1B0E' }]

const renderedFile = {
  pdf: new Blob(['%PDF'], { type: 'application/pdf' }),
  thumbnail: new Blob(['jpg'], { type: 'image/jpeg' }),
  pageCount: 4,
  format: { widthMm: 297, heightMm: 210 },
}
const uploadedFile = {
  printId: '0b6e3c1e-6f7a-4c1e-9d2b-3a4b5c6d7e8f',
  pdfUrl: 'https://firebasestorage.googleapis.com/v0/b/k/o/printFiles%2Ffam%2Fp%2Fbook.pdf?alt=media&token=t',
  thumbnailUrl: 'https://firebasestorage.googleapis.com/v0/b/k/o/printFiles%2Ffam%2Fp%2Fcover.jpg?alt=media&token=u',
}
const checkout = {
  checkoutUrl: 'https://www.peecho.com/checkout/print/en/dec27b95?token=4b33',
  expiresAt: '2026-10-03T18:00:00.000Z',
}

function open(props = {}) {
  const onRender = props.onRender ?? vi.fn(async ({ onProgress }) => {
    onProgress({ done: 4, total: 4 })
    return renderedFile
  })
  const onClose = props.onClose ?? vi.fn()
  render(<PrintOrderModal familyId="fam" title="Summer" sheets={sheets} onRender={onRender} onClose={onClose} {...props} />)
  return { onRender, onClose }
}

const prepare = () => fireEvent.click(screen.getByRole('button', { name: 'Prepare print file' }))

beforeEach(() => {
  vi.stubEnv('VITE_PEECHO_CURRENCY', 'EUR')
  uploadPrintFile.mockReset().mockResolvedValue(uploadedFile)
  createPrintCheckout.mockReset().mockResolvedValue(checkout)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('PrintOrderModal', () => {
  it('describes the book and says the print file is unencrypted before making anything', () => {
    const { onRender } = open()
    expect(screen.getByText('4 pages · 29.7 × 21 cm')).toBeInTheDocument()
    expect(screen.getByText(/blank page goes in before the back cover/)).toBeInTheDocument()
    expect(screen.getByText(/Hardcover books need at least 24 pages, and this one has 4/)).toBeInTheDocument()
    expect(screen.getByText('This copy is not encrypted')).toBeInTheDocument()
    expect(screen.getByText(/unencrypted PDF.*deleted automatically after 30 days/)).toBeInTheDocument()
    expect(onRender).not.toHaveBeenCalled()
    expect(uploadPrintFile).not.toHaveBeenCalled()
  })

  it('renders, uploads, and opens a checkout for the uploaded file', async () => {
    const { onRender } = open()
    prepare()

    const link = await screen.findByRole('link', { name: 'Order at Peecho' })
    expect(onRender).toHaveBeenCalledTimes(1)
    expect(uploadPrintFile).toHaveBeenCalledWith(expect.objectContaining({
      familyId: 'fam',
      pdf: renderedFile.pdf,
      thumbnail: renderedFile.thumbnail,
    }))
    expect(createPrintCheckout).toHaveBeenCalledWith({
      familyId: 'fam',
      printId: uploadedFile.printId,
      pageCount: 4,
      format: { widthMm: 297, heightMm: 210 },
      currency: 'EUR',
      language: 'en',
      title: 'Summer',
    })
    expect(link).toHaveAttribute('href', checkout.checkoutUrl)
    expect(link).toHaveAttribute('target', '_blank')
    expect(screen.getByText('The checkout link works until October 3, 2026.')).toBeInTheDocument()
    expect(screen.getByText('View the print file').closest('a')).toHaveAttribute('href', uploadedFile.pdfUrl)
  })

  it('retries only the checkout when Peecho failed, without making the file again', async () => {
    createPrintCheckout.mockRejectedValueOnce(new Error('unavailable'))
    const { onRender } = open()
    prepare()
    expect(await screen.findByRole('alert')).toHaveTextContent('Peecho did not open a checkout')

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('link', { name: 'Order at Peecho' })).toBeInTheDocument()
    expect(onRender).toHaveBeenCalledTimes(1)
    expect(uploadPrintFile).toHaveBeenCalledTimes(1)
    expect(createPrintCheckout).toHaveBeenCalledTimes(2)
  })

  it('offers another try when the print file cannot be made', async () => {
    const onRender = vi.fn()
      .mockRejectedValueOnce(new Error('html2canvas fell over'))
      .mockResolvedValueOnce(renderedFile)
    open({ onRender })
    prepare()
    expect(await screen.findByRole('alert')).toHaveTextContent('The print file could not be prepared')
    expect(uploadPrintFile).not.toHaveBeenCalled()
    expect(createPrintCheckout).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('link', { name: 'Order at Peecho' })).toBeInTheDocument()
    expect(onRender).toHaveBeenCalledTimes(2)
  })

  it('stops rendering and uploads nothing when cancelled', async () => {
    let finishRender
    let isCancelled
    const onRender = vi.fn((options) => {
      isCancelled = options.isCancelled
      options.onProgress({ done: 1, total: 4 })
      return new Promise((resolve) => { finishRender = resolve })
    })
    const { onClose } = open({ onRender })
    prepare()
    expect(await screen.findByText('Preparing page 2 of 4…')).toBeInTheDocument()
    expect(isCancelled()).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
    expect(isCancelled()).toBe(true)

    finishRender(renderedFile)
    await waitFor(() => expect(onRender).toHaveBeenCalled())
    expect(uploadPrintFile).not.toHaveBeenCalled()
    expect(createPrintCheckout).not.toHaveBeenCalled()
  })

  it('ignores a backdrop click while it is working', async () => {
    const onRender = vi.fn(() => new Promise(() => {}))
    const { onClose } = open({ onRender })
    prepare()
    await screen.findByText(/Preparing page/)
    fireEvent.click(document.querySelector('.bg-black\\/50'))
    expect(onClose).not.toHaveBeenCalled()
  })
})

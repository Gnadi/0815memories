/**
 * Ordering a printed scrapbook — PrintOrderModal.
 *
 * The dialog must say the print file is unencrypted before it makes one, hand
 * Peecho exactly the file it uploaded, and stop rendering and uploading the
 * moment the admin walks away.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// The link's text is Peecho's to write (see PeechoPrintButton), so tests find
// it by its class.
const peechoLink = () => waitFor(() => {
  const link = document.querySelector('a.peecho-print-button')
  if (!link) throw new Error('no Peecho button yet')
  return link
})

vi.mock('../utils/printUpload', () => ({ uploadPrintFile: vi.fn() }))
vi.mock('../utils/peechoButton', () => ({ loadPeechoButtons: vi.fn() }))

const { uploadPrintFile } = await import('../utils/printUpload')
const { loadPeechoButtons } = await import('../utils/peechoButton')
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
  printId: 'print-123',
  pdfUrl: 'https://firebasestorage.googleapis.com/v0/b/k/o/printFiles%2Ffam%2Fprint-123%2Fbook.pdf?alt=media&token=t',
  thumbnailUrl: 'https://firebasestorage.googleapis.com/v0/b/k/o/printFiles%2Ffam%2Fprint-123%2Fcover.jpg?alt=media&token=u',
}

function open(props = {}) {
  const onRender = props.onRender ?? vi.fn(async ({ onProgress }) => {
    onProgress({ done: 4, total: 4 })
    return renderedFile
  })
  const onClose = props.onClose ?? vi.fn()
  render(<PrintOrderModal familyId="fam" sheets={sheets} onRender={onRender} onClose={onClose} {...props} />)
  return { onRender, onClose }
}

beforeEach(() => {
  vi.stubEnv('VITE_PEECHO_BUTTON_KEY', 'key123')
  uploadPrintFile.mockReset().mockResolvedValue(uploadedFile)
  loadPeechoButtons.mockReset().mockResolvedValue()
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

  it('renders, uploads, and hands Peecho the uploaded file', async () => {
    const { onRender } = open()
    fireEvent.click(screen.getByRole('button', { name: 'Prepare print file' }))

    const link = await peechoLink()
    expect(onRender).toHaveBeenCalledTimes(1)
    expect(uploadPrintFile).toHaveBeenCalledWith(expect.objectContaining({
      familyId: 'fam',
      pdf: renderedFile.pdf,
      thumbnail: renderedFile.thumbnail,
    }))

    expect(link).toHaveAttribute('href', 'https://www.peecho.com/')
    expect(link).toHaveAttribute('data-text', 'Order at Peecho')
    expect(link).toHaveAttribute('data-new-window', 'true')
    expect(link).toHaveAttribute('data-style', 'false')
    expect(link).toBeEmptyDOMElement()
    expect(link).toHaveAttribute('data-src', uploadedFile.pdfUrl)
    expect(link).toHaveAttribute('data-thumbnail', uploadedFile.thumbnailUrl)
    expect(link).toHaveAttribute('data-pages', '4')
    expect(link).toHaveAttribute('data-width', '297')
    expect(link).toHaveAttribute('data-height', '210')
    expect(link).toHaveAttribute('data-reference', 'print-123')
    expect(loadPeechoButtons).toHaveBeenCalledWith('key123')
    expect(screen.getByText('View the print file').closest('a')).toHaveAttribute('href', uploadedFile.pdfUrl)
  })

  it('says so when Peecho’s checkout cannot be loaded', async () => {
    loadPeechoButtons.mockRejectedValue(new Error('blocked'))
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Prepare print file' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/checkout could not be loaded/)
  })

  it('says so when none of the shop\u2019s products fits the book', async () => {
    // What Peecho's script does to a button no product matches.
    loadPeechoButtons.mockImplementation(async () => {
      document.querySelector('a.peecho-print-button').classList.add('peecho-btn', 'peecho-btn-disabled')
    })
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Prepare print file' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Peecho has no product for a book of 4 pages')
    expect(document.querySelector('a.peecho-print-button')).toBeInTheDocument()
  })

  it('offers another try when the print file cannot be made', async () => {
    const onRender = vi.fn()
      .mockRejectedValueOnce(new Error('html2canvas fell over'))
      .mockResolvedValueOnce(renderedFile)
    open({ onRender })
    fireEvent.click(screen.getByRole('button', { name: 'Prepare print file' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The print file could not be prepared')
    expect(uploadPrintFile).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await peechoLink()).toBeInTheDocument()
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
    fireEvent.click(screen.getByRole('button', { name: 'Prepare print file' }))
    expect(await screen.findByText('Preparing page 2 of 4…')).toBeInTheDocument()
    expect(isCancelled()).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
    expect(isCancelled()).toBe(true)

    finishRender(renderedFile)
    await waitFor(() => expect(onRender).toHaveBeenCalled())
    expect(uploadPrintFile).not.toHaveBeenCalled()
  })

  it('ignores a backdrop click while it is working', async () => {
    const onRender = vi.fn(() => new Promise(() => {}))
    const { onClose } = open({ onRender })
    fireEvent.click(screen.getByRole('button', { name: 'Prepare print file' }))
    await screen.findByText(/Preparing page/)
    fireEvent.click(document.querySelector('.bg-black\\/50'))
    expect(onClose).not.toHaveBeenCalled()
  })
})

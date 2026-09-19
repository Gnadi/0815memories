import { useCallback, useRef, useState } from 'react'
import { saveAs } from 'file-saver'
import { useAuth } from '../context/AuthContext'
import { loadImageSizes, renderScrapbookToPrintPdf } from '../utils/printRenderer'
import { assemblePrintPages, runPreflight } from '../utils/printPreflight'
import { getFormat, getProduct } from '../utils/printFormats'
import { exportFileName } from '../utils/helpers'
import { devError } from '../utils/devLog'

/**
 * The ordering pipeline, minus the ordering.
 *
 * The preflight and the render both need every photo, but they need different
 * things from them. The preflight asks how many of an original's pixels land on
 * the page — arithmetic over two numbers — so it keeps only the sizes. The
 * render needs the pixels themselves, and streams them a page at a time.
 *
 * Holding every decoded photo across both would be the single largest thing in
 * memory: a hundred-page book of 12 MP originals is gigabytes of bitmap, which
 * is how a phone loses the tab halfway through.
 */
export function useScrapbookPrint(pages, { formatId, productId } = {}) {
  const { encryptionKey } = useAuth()

  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState(null)
  const [preflight, setPreflight] = useState(null)
  const [error, setError] = useState(null)

  const imagesRef = useRef(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setProgress(null)
    setPreflight(null)
    setError(null)
    imagesRef.current = null
  }, [])

  /** Decrypt the book's photos and report what a press would object to. */
  const analyze = useCallback(async () => {
    setStatus('analyzing')
    setError(null)
    setProgress(null)
    try {
      const { images } = await loadImageSizes(pages, encryptionKey, { onProgress: setProgress })
      imagesRef.current = images
      const result = runPreflight(pages, images, { formatId, productId })
      setPreflight(result)
      setStatus('idle')
      return result
    } catch (err) {
      devError('Print preflight failed', err)
      setError(err)
      setStatus('error')
      return null
    }
  }, [pages, encryptionKey, formatId, productId])

  /**
   * Render the book to a print-ready PDF.
   *
   * `padPages` is the user's answer to the binding question: blank pages are
   * appended only because they said so, never silently.
   */
  const createPrintFile = useCallback(async ({ padPages = false } = {}) => {
    setStatus('rendering')
    setError(null)
    setProgress(null)
    try {
      const product = getProduct(productId)
      const sequence = padPages ? assemblePrintPages(pages, product).pages : pages

      // No `images` passed: the renderer streams them through its own bounded
      // cache. What `analyze` left in the ref is sizes, not bitmaps, and would
      // draw nothing.
      const result = await renderScrapbookToPrintPdf(sequence, {
        encryptionKey,
        formatId,
        onProgress: setProgress,
      })
      setStatus('ready')
      return result
    } catch (err) {
      devError('Print render failed', err)
      setError(err)
      setStatus('error')
      return null
    }
  }, [pages, encryptionKey, formatId, productId])

  /** Save the print file locally — the way to judge a book before ordering one. */
  const downloadPrintFile = useCallback(async ({ title, padPages }) => {
    const result = await createPrintFile({ padPages })
    if (!result) return null
    const format = getFormat(formatId)
    saveAs(result.blob, exportFileName(`${title} ${format.widthMm}x${format.heightMm}`, 'pdf', { fallback: 'Scrapbook-Druck' }))
    return result
  }, [createPrintFile, formatId])

  return {
    status,
    progress,
    preflight,
    error,
    analyze,
    createPrintFile,
    downloadPrintFile,
    reset,
    busy: status === 'analyzing' || status === 'rendering' || status === 'uploading',
  }
}

export default useScrapbookPrint

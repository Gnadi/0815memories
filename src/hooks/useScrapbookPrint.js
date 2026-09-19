import { useCallback, useRef, useState } from 'react'
import { saveAs } from 'file-saver'
import { useAuth } from '../context/AuthContext'
import { loadPrintImages, renderScrapbookToPrintPdf } from '../utils/printRenderer'
import { assemblePrintPages, runPreflight } from '../utils/printPreflight'
import { uploadPrintFile } from '../utils/printFileStore'
import { getFormat, getProduct } from '../utils/printFormats'
import { exportFileName } from '../utils/helpers'
import { devError } from '../utils/devLog'

/**
 * The ordering pipeline, minus the ordering.
 *
 * Producing a book is three long steps — decrypt every photo, check the result,
 * then draw it at print size — and the expensive one is the first. Keeping the
 * loaded images in a ref means the preflight and the render share one decrypt
 * pass, so re-rendering after the user answers a question about page count
 * costs seconds rather than minutes.
 */
export function useScrapbookPrint(pages, { formatId, productId } = {}) {
  const { familyId, encryptionKey } = useAuth()

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
      const { images } = await loadPrintImages(pages, encryptionKey, { onProgress: setProgress })
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

      let images = imagesRef.current
      if (!images) {
        const loaded = await loadPrintImages(sequence, encryptionKey, { onProgress: setProgress })
        images = loaded.images
        imagesRef.current = images
      }

      const result = await renderScrapbookToPrintPdf(sequence, {
        encryptionKey,
        formatId,
        images,
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

  /**
   * Hand the print file to the store a print network can fetch it from.
   *
   * Unused until the provider is wired up in the next phase; it is here so the
   * one piece that punctures the encryption model is written, reviewed and
   * bounded now rather than in the rush of an integration.
   */
  const uploadForPrinter = useCallback(async ({ scrapbookId, title, blob }) => {
    setStatus('uploading')
    try {
      const result = await uploadPrintFile(blob, {
        familyId,
        scrapbookId,
        fileName: exportFileName(title, 'pdf', { fallback: 'Scrapbook' }),
        onProgress: setProgress,
      })
      setStatus('ready')
      return result
    } catch (err) {
      devError('Print upload failed', err)
      setError(err)
      setStatus('error')
      return null
    }
  }, [familyId])

  return {
    status,
    progress,
    preflight,
    error,
    analyze,
    createPrintFile,
    downloadPrintFile,
    uploadForPrinter,
    reset,
    busy: status === 'analyzing' || status === 'rendering' || status === 'uploading',
  }
}

export default useScrapbookPrint

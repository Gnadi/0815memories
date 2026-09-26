import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Loader2, Printer, LockOpen, Info, ExternalLink, RotateCcw } from 'lucide-react'
import {
  printConfig,
  HARDCOVER_MIN_PAGES,
  PRINT_FILE_RETENTION_DAYS,
} from '../../utils/printBook'
import { uploadPrintFile } from '../../utils/printUpload'
import { createPrintCheckout } from '../../utils/printCheckout'
import { devError } from '../../utils/devLog'

/**
 * "Print" — order the scrapbook as a printed book from Peecho.
 *
 * Kaydo's part ends at the checkout: it renders the print file (through
 * `onRender`, which the editor provides because only the editor can draw its
 * pages), uploads it, and has the createPrintCheckout Cloud Function open a
 * Peecho checkout for it. Product, address and payment all happen at Peecho —
 * see utils/printBook.js for why.
 *
 * The dialog says up front that the file is unencrypted, before anything is
 * rendered: it is the one time the app hands a family's photos to someone
 * outside it in readable form.
 *
 * `sheets` is the book as it will be printed (printSequence); `title` names
 * it at the checkout.
 */
export default function PrintOrderModal({ familyId, title, sheets, onRender, onClose }) {
  const { t, i18n } = useTranslation('scrapbook')
  const config = useMemo(() => printConfig(), [])
  // 'intro' | 'rendering' | 'uploading' | 'checkout' | 'ready' | 'error'
  const [phase, setPhase] = useState('intro')
  const [rendered, setRendered] = useState({ done: 0, total: sheets.length })
  const [uploaded, setUploaded] = useState(0)
  // The uploaded print file, kept so a failed checkout can be retried alone.
  const [file, setFile] = useState(null)
  const [checkout, setCheckout] = useState(null)
  // Where it went wrong: 'file' (render or upload) or 'checkout' (Peecho).
  const [failedAt, setFailedAt] = useState(null)
  const cancelledRef = useRef(false)

  // Leaving the dialog, however it happens, stops a render or upload under way.
  useEffect(() => () => { cancelledRef.current = true }, [])

  const busy = phase === 'rendering' || phase === 'uploading' || phase === 'checkout'
  const pageCount = sheets.length
  const blankAdded = sheets.some((sheet) => sheet.kind === 'blank')

  const cm = (mm) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(mm / 10)

  const isCancelled = () => cancelledRef.current

  const openCheckout = async (printFile) => {
    setPhase('checkout')
    try {
      const result = await createPrintCheckout({
        familyId,
        printId: printFile.printId,
        pageCount: printFile.pageCount,
        format: printFile.format,
        currency: config.currency,
        language: i18n.language,
        title,
      })
      if (isCancelled()) return
      setCheckout(result)
      setPhase('ready')
    } catch (err) {
      if (isCancelled()) return
      devError('Creating the Peecho checkout failed', err)
      setFailedAt('checkout')
      setPhase('error')
    }
  }

  const handlePrepare = async () => {
    cancelledRef.current = false
    setFailedAt(null)
    setRendered({ done: 0, total: pageCount })
    setPhase('rendering')
    let printFile
    try {
      const rendering = await onRender({ onProgress: setRendered, isCancelled })
      if (!rendering || isCancelled()) return
      setUploaded(0)
      setPhase('uploading')
      const upload = await uploadPrintFile({
        familyId,
        pdf: rendering.pdf,
        thumbnail: rendering.thumbnail,
        onProgress: setUploaded,
        isCancelled,
      })
      if (!upload || isCancelled()) return
      printFile = { ...upload, pageCount: rendering.pageCount, format: rendering.format }
      setFile(printFile)
    } catch (err) {
      if (isCancelled()) return
      devError('Preparing the print file failed', err)
      setFailedAt('file')
      setPhase('error')
      return
    }
    await openCheckout(printFile)
  }

  const handleRetry = () => {
    cancelledRef.current = false
    if (failedAt === 'checkout' && file) {
      setFailedAt(null)
      openCheckout(file)
    } else {
      handlePrepare()
    }
  }

  const handleClose = () => {
    cancelledRef.current = true
    onClose()
  }

  const renderedFraction = rendered.total > 0 ? rendered.done / rendered.total : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={busy ? undefined : handleClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-order-title"
        className="relative bg-warm-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-cream-dark">
          <div>
            <h2 id="print-order-title" className="text-lg font-bold text-bark flex items-center gap-2">
              <Printer className="w-5 h-5 text-kaydo" />
              {t('print.title')}
            </h2>
            <p className="text-xs text-bark-muted mt-0.5">{t('print.subtitle')}</p>
          </div>
          <button onClick={handleClose} className="text-bark-muted hover:text-bark" aria-label={t('print.close')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
          {phase === 'intro' && (
            <>
              <div>
                <p className="font-semibold text-bark">
                  {t('print.summary', { count: pageCount, width: cm(config.widthMm), height: cm(config.heightMm) })}
                </p>
                <p className="text-bark-muted mt-1">{t('print.pagesExplained')}</p>
                {blankAdded && <p className="text-bark-muted mt-1">{t('print.blankAdded')}</p>}
              </div>

              {pageCount < HARDCOVER_MIN_PAGES && (
                <p className="px-3 py-2 rounded-xl bg-cream text-bark flex gap-2">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-kaydo" />
                  <span>{t('print.tooFewPages', { min: HARDCOVER_MIN_PAGES, count: pageCount })}</span>
                </p>
              )}

              <p className="text-bark-muted">{t('print.marginTip')}</p>

              <div className="px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900">
                <p className="font-semibold flex items-center gap-2">
                  <LockOpen className="w-4 h-4" />
                  {t('print.privacyHeading')}
                </p>
                <p className="mt-1">{t('print.privacyBody', { days: PRINT_FILE_RETENTION_DAYS })}</p>
              </div>
            </>
          )}

          {busy && (
            <div className="py-6 space-y-3" aria-live="polite">
              <p className="text-bark text-center">
                {phase === 'rendering'
                  ? t('print.rendering', { current: Math.min(rendered.done + 1, rendered.total), total: rendered.total })
                  : phase === 'uploading'
                    ? t('print.uploading', { percent: Math.round(uploaded * 100) })
                    : t('print.creatingCheckout')}
              </p>
              <div className="h-2 rounded-full bg-cream-dark overflow-hidden">
                <div
                  className="h-full bg-kaydo transition-[width] duration-300"
                  style={{ width: `${Math.round((phase === 'rendering' ? renderedFraction : phase === 'uploading' ? uploaded : 1) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-bark-muted text-center">{t('print.keepOpen')}</p>
            </div>
          )}

          {phase === 'ready' && checkout && (
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-bark">{t('print.readyHeading')}</p>
                <p className="text-bark-muted mt-1">{t('print.readyBody')}</p>
              </div>
              <div className="flex justify-center">
                <a
                  href={checkout.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-kaydo inline-flex items-center gap-2 text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t('print.orderAtPeecho')}
                </a>
              </div>
              <p className="text-xs text-bark-muted text-center">
                {t('print.linkExpires', { date: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(new Date(checkout.expiresAt)) })}
              </p>
              <a
                href={file.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs text-bark-muted hover:text-kaydo"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {t('print.preview')}
              </a>
            </div>
          )}

          {phase === 'error' && (
            <p role="alert" className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700">
              {failedAt === 'checkout' ? t('print.checkoutFailed') : t('print.failed')}
            </p>
          )}
        </div>

        <div className="p-5 border-t border-cream-dark flex items-center justify-end gap-3">
          {busy && (
            <button onClick={handleClose} className="text-sm font-medium text-bark-muted hover:text-bark px-3 py-2">
              {t('print.cancel')}
            </button>
          )}
          {phase === 'intro' && (
            <button onClick={handlePrepare} className="btn-kaydo flex items-center gap-2 text-sm">
              <Printer className="w-4 h-4" />
              {t('print.prepare')}
            </button>
          )}
          {busy && (
            <button disabled className="btn-kaydo flex items-center gap-2 text-sm opacity-60">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('print.prepare')}
            </button>
          )}
          {phase === 'error' && (
            <button onClick={handleRetry} className="btn-kaydo flex items-center gap-2 text-sm">
              <RotateCcw className="w-4 h-4" />
              {t('print.tryAgain')}
            </button>
          )}
          {phase === 'ready' && (
            <button onClick={handleClose} className="text-sm font-medium text-bark-muted hover:text-bark px-3 py-2">
              {t('print.close')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

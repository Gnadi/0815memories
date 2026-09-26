import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Loader2, Printer, LockOpen, Info, ExternalLink, RotateCcw } from 'lucide-react'
import PeechoPrintButton from './PeechoPrintButton'
import {
  printConfig,
  printButtonAttributes,
  HARDCOVER_MIN_PAGES,
  PRINT_FILE_RETENTION_DAYS,
} from '../../utils/printBook'
import { uploadPrintFile } from '../../utils/printUpload'
import { devError } from '../../utils/devLog'

/**
 * "Print" — order the scrapbook as a printed book from Peecho.
 *
 * Kaydo's part ends at the checkout: it renders the print file (through
 * `onRender`, which the editor provides because only the editor can draw its
 * pages), uploads it, and shows Peecho's print button. Product, address and
 * payment all happen at Peecho — see utils/printBook.js for why.
 *
 * The dialog says up front that the file is unencrypted, before anything is
 * rendered: it is the one time the app hands a family's photos to someone
 * outside it in readable form.
 *
 * `sheets` is the book as it will be printed (printSequence).
 */
export default function PrintOrderModal({ familyId, sheets, onRender, onClose }) {
  const { t, i18n } = useTranslation('scrapbook')
  const config = useMemo(() => printConfig(), [])
  // 'intro' | 'rendering' | 'uploading' | 'ready' | 'error'
  const [phase, setPhase] = useState('intro')
  const [rendered, setRendered] = useState({ done: 0, total: sheets.length })
  const [uploaded, setUploaded] = useState(0)
  const [result, setResult] = useState(null)
  // null | 'failed' (Peecho's script did not load) | 'noProduct' (no product fits)
  const [checkoutStatus, setCheckoutStatus] = useState(null)
  const cancelledRef = useRef(false)

  // Leaving the dialog, however it happens, stops a render or upload under way.
  useEffect(() => () => { cancelledRef.current = true }, [])

  const busy = phase === 'rendering' || phase === 'uploading'
  const pageCount = sheets.length
  const blankAdded = sheets.some((sheet) => sheet.kind === 'blank')

  const cm = (mm) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(mm / 10)

  const handlePrepare = async () => {
    cancelledRef.current = false
    const isCancelled = () => cancelledRef.current
    setCheckoutStatus(null)
    setRendered({ done: 0, total: pageCount })
    setPhase('rendering')
    try {
      const file = await onRender({ onProgress: setRendered, isCancelled })
      if (!file || isCancelled()) return
      setUploaded(0)
      setPhase('uploading')
      const upload = await uploadPrintFile({
        familyId,
        pdf: file.pdf,
        thumbnail: file.thumbnail,
        onProgress: setUploaded,
        isCancelled,
      })
      if (!upload || isCancelled()) return
      setResult({ ...upload, pageCount: file.pageCount, format: file.format })
      setPhase('ready')
    } catch (err) {
      if (isCancelled()) return
      devError('Preparing the print file failed', err)
      setPhase('error')
    }
  }

  const handleClose = () => {
    cancelledRef.current = true
    onClose()
  }

  const buttonAttributes = useMemo(() => (result
    ? printButtonAttributes({
      pdfUrl: result.pdfUrl,
      thumbnailUrl: result.thumbnailUrl,
      pageCount: result.pageCount,
      format: result.format,
      reference: result.printId,
      language: i18n.language,
      currency: config.currency,
    })
    : null), [result, i18n.language, config.currency])

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
                  : t('print.uploading', { percent: Math.round(uploaded * 100) })}
              </p>
              <div className="h-2 rounded-full bg-cream-dark overflow-hidden">
                <div
                  className="h-full bg-kaydo transition-[width] duration-300"
                  style={{ width: `${Math.round((phase === 'rendering' ? renderedFraction : uploaded) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-bark-muted text-center">{t('print.keepOpen')}</p>
            </div>
          )}

          {phase === 'ready' && result && (
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-bark">{t('print.readyHeading')}</p>
                <p className="text-bark-muted mt-1">{t('print.readyBody')}</p>
              </div>
              {checkoutStatus === 'failed' ? (
                <p role="alert" className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700">
                  {t('print.checkoutUnavailable')}
                </p>
              ) : (
                <PeechoPrintButton
                  buttonKey={config.buttonKey}
                  attributes={buttonAttributes}
                  label={t('print.orderAtPeecho')}
                  onStatus={setCheckoutStatus}
                />
              )}
              {checkoutStatus === 'noProduct' && (
                <p role="alert" className="px-3 py-2 rounded-xl bg-cream text-bark">
                  {t('print.noProduct', { count: result.pageCount })}
                </p>
              )}
              <a
                href={result.pdfUrl}
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
              {t('print.failed')}
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
            <button onClick={handlePrepare} className="btn-kaydo flex items-center gap-2 text-sm">
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

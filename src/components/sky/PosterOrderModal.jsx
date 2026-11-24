import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Loader2, Printer, LockOpen, Info, ExternalLink, RotateCcw, Eye } from 'lucide-react'
import { printConfig, PRINT_FILE_RETENTION_DAYS } from '../../utils/printBook'
import { posterPrintFormat } from '../../utils/sky/posterExport'
import { uploadPrintFile } from '../../utils/printUpload'
import { createPrintCheckout } from '../../utils/printCheckout'
import { devError } from '../../utils/devLog'
import { isDemoMode } from '../../demo/demoMode'

/**
 * "Order as a wall print" — the birth sky poster, printed by Peecho.
 *
 * The same road as a printed scrapbook (components/scrapbook/PrintOrderModal):
 * the poster is rendered into a one-page print file, uploaded where Peecho can
 * fetch it, and the createPrintCheckout Cloud Function opens a checkout for
 * it. Product, address and payment are Peecho's.
 *
 * The dialog says before anything is made that the file is unencrypted and
 * what is on it: a child's name, and when and where they were born.
 *
 * `onRender` makes the print file (utils/sky/posterExport renderPosterPrintFile);
 * `ready` is false while the sky is still being worked out.
 */
export default function PosterOrderModal({ familyId, title, ready, onRender, onClose }) {
  const { t, i18n } = useTranslation('sky')
  // The demo explains and stops before anything is made, as for books.
  const isDemo = isDemoMode()
  const config = useMemo(() => printConfig(), [])
  const format = useMemo(() => posterPrintFormat(), [])
  // 'intro' | 'rendering' | 'uploading' | 'checkout' | 'ready' | 'error'
  const [phase, setPhase] = useState('intro')
  const [uploaded, setUploaded] = useState(0)
  // The uploaded print file, kept so a failed checkout can be retried alone.
  const [file, setFile] = useState(null)
  const [checkout, setCheckout] = useState(null)
  const [failedAt, setFailedAt] = useState(null)
  const [quotaUsed, setQuotaUsed] = useState(false)
  const cancelledRef = useRef(false)

  // Leaving the dialog, however it happens, stops an upload under way.
  useEffect(() => () => { cancelledRef.current = true }, [])

  const busy = phase === 'rendering' || phase === 'uploading' || phase === 'checkout'
  const isCancelled = () => cancelledRef.current
  const cm = (mm) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(mm / 10)

  const openCheckout = async (printFile) => {
    setPhase('checkout')
    try {
      const result = await createPrintCheckout({
        familyId,
        printId: printFile.printId,
        product: 'poster',
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
    setQuotaUsed(false)
    setPhase('rendering')
    let printFile
    try {
      // Let the dialog show its busy state before the canvas work blocks the thread.
      await new Promise((r) => setTimeout(r, 30))
      const rendering = await onRender()
      if (isCancelled()) return
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
      devError('Preparing the poster print file failed', err)
      if (err?.code === 'print-quota') setQuotaUsed(true)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={busy ? undefined : handleClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="poster-order-title"
        className="relative bg-warm-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-xl"
      >
        <div className="flex items-center justify-between p-5 border-b border-cream-dark">
          <div>
            <h2 id="poster-order-title" className="text-lg font-bold text-bark flex items-center gap-2">
              <Printer className="w-5 h-5 text-kaydo" />
              {t('order.title')}
            </h2>
            <p className="text-xs text-bark-muted mt-0.5">{t('order.subtitle')}</p>
          </div>
          <button onClick={handleClose} className="text-bark-muted hover:text-bark" aria-label={t('order.close')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
          {phase === 'intro' && (
            <>
              <div>
                <p className="font-semibold text-bark">
                  {t('order.summary', { width: cm(format.widthMm), height: cm(format.heightMm) })}
                </p>
                <p className="text-bark-muted mt-1">{t('order.productsExplained')}</p>
              </div>

              <div className="px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900">
                <p className="font-semibold flex items-center gap-2">
                  <LockOpen className="w-4 h-4" />
                  {t('order.privacyHeading')}
                </p>
                <p className="mt-1">{t('order.privacyBody', { days: PRINT_FILE_RETENTION_DAYS })}</p>
              </div>

              {isDemo && (
                <p className="px-3 py-2 rounded-xl bg-cream text-bark flex gap-2">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-kaydo" />
                  <span>{t('order.demoUnavailable')}</span>
                </p>
              )}
            </>
          )}

          {busy && (
            <div className="py-6 space-y-3" aria-live="polite">
              <p className="text-bark text-center">
                {phase === 'rendering'
                  ? t('order.rendering')
                  : phase === 'uploading'
                    ? t('order.uploading', { percent: Math.round(uploaded * 100) })
                    : t('order.creatingCheckout')}
              </p>
              <div className="h-2 rounded-full bg-cream-dark overflow-hidden">
                <div
                  className="h-full bg-kaydo transition-[width] duration-300"
                  style={{ width: `${Math.round((phase === 'rendering' ? 0.05 : phase === 'uploading' ? uploaded : 1) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-bark-muted text-center">{t('order.keepOpen')}</p>
            </div>
          )}

          {phase === 'ready' && checkout && (
            <ol className="space-y-4">
              <li className="rounded-xl border border-cream-dark p-4">
                <p className="font-semibold text-bark flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-kaydo text-white text-xs flex items-center justify-center">1</span>
                  {t('order.checkHeading')}
                </p>
                <p className="text-bark-muted mt-1">{t('order.checkBody')}</p>
                <a
                  href={file.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-kaydo text-kaydo font-semibold hover:bg-kaydo/5 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  {t('order.preview')}
                </a>
              </li>
              <li className="rounded-xl border border-cream-dark p-4">
                <p className="font-semibold text-bark flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-kaydo text-white text-xs flex items-center justify-center">2</span>
                  {t('order.readyHeading')}
                </p>
                <p className="text-bark-muted mt-1">{t('order.readyBody')}</p>
                <a
                  href={checkout.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-kaydo mt-3 w-full inline-flex items-center justify-center gap-2 text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t('order.orderAtPeecho')}
                </a>
                <p className="text-xs text-bark-muted text-center mt-2">
                  {t('order.linkExpires', { date: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(new Date(checkout.expiresAt)) })}
                </p>
              </li>
            </ol>
          )}

          {phase === 'error' && (
            <p role="alert" className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700">
              {failedAt === 'checkout' ? t('order.checkoutFailed') : quotaUsed ? t('order.quotaUsed') : t('order.failed')}
            </p>
          )}
        </div>

        <div className="p-5 border-t border-cream-dark flex items-center justify-end gap-3">
          {busy && (
            <button onClick={handleClose} className="text-sm font-medium text-bark-muted hover:text-bark px-3 py-2">
              {t('order.cancel')}
            </button>
          )}
          {phase === 'intro' && (
            <button
              onClick={handlePrepare}
              disabled={isDemo || !ready}
              className="btn-kaydo flex items-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {ready ? <Printer className="w-4 h-4" /> : <Loader2 className="w-4 h-4 animate-spin" />}
              {t('order.prepare')}
            </button>
          )}
          {busy && (
            <button disabled className="btn-kaydo flex items-center gap-2 text-sm opacity-60">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('order.prepare')}
            </button>
          )}
          {phase === 'error' && (
            <button onClick={handleRetry} className="btn-kaydo flex items-center gap-2 text-sm">
              <RotateCcw className="w-4 h-4" />
              {t('order.tryAgain')}
            </button>
          )}
          {phase === 'ready' && (
            <button onClick={handleClose} className="text-sm font-medium text-bark-muted hover:text-bark px-3 py-2">
              {t('order.close')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

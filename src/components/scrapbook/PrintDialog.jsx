import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Loader2, AlertTriangle, AlertCircle, Info, CheckCircle2, Printer, Download, ArrowLeft } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useScrapbookPrint } from '../../hooks/useScrapbookPrint'
import { usePrintOrders } from '../../hooks/usePrintOrders'
import { ISSUE, LEVEL } from '../../utils/printPreflight'
import { PRINT_FORMATS, DEFAULT_FORMAT_ID, DEFAULT_PRODUCT_ID, getFormat, getProduct } from '../../utils/printFormats'
import { assemblePrintPages } from '../../utils/printPreflight'
import { normalizeOfferings, offeringsForFormat } from '../../utils/printCatalog'
import { fetchOfferings, fetchQuote } from '../../utils/printApi'
import { printErrorKey } from '../../utils/printErrors'
import PrintAddressForm from './PrintAddressForm'
import { EMPTY_ADDRESS, addressErrors } from '../../utils/printAddress'
import { devError } from '../../utils/devLog'

const LEVEL_ICON = { [LEVEL.ERROR]: AlertCircle, [LEVEL.WARNING]: AlertTriangle, [LEVEL.DECISION]: Info }
const LEVEL_CLASS = { [LEVEL.ERROR]: 'text-red-600', [LEVEL.WARNING]: 'text-amber-600', [LEVEL.DECISION]: 'text-bark-muted' }

function formatBytes(bytes) {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`
}

function IssueRow({ issue, t }) {
  const Icon = LEVEL_ICON[issue.level] || Info
  const page = issue.pageIndex != null ? t('print.issues.onPage', { page: issue.pageIndex + 1 }) : null
  return (
    <li className="flex items-start gap-2 text-xs leading-relaxed">
      <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${LEVEL_CLASS[issue.level] || ''}`} />
      <span className="text-bark">
        {t(`print.issues.${issue.code}`, issue)}
        {page && <span className="text-bark-muted"> · {page}</span>}
      </span>
    </li>
  )
}

/**
 * From a finished scrapbook to a book in the post.
 *
 * Four steps, in the order the decisions actually have to be made: what a press
 * would object to, what to order, what it costs, and then — and only then —
 * placing it. Downloading the print file stays available throughout, because
 * looking at the thing before buying it is the most reasonable request a person
 * can make of a printing flow.
 *
 * Nothing here is a confirmation prompt. Each step shows something the user can
 * still act on while acting on it is free.
 */
export default function PrintDialog({ pages, title, scrapbookId, onClose }) {
  const { t } = useTranslation('scrapbook')
  const { user, familyId } = useAuth()

  const [step, setStep] = useState('check')
  const [formatId, setFormatId] = useState(DEFAULT_FORMAT_ID)
  const [quantity, setQuantity] = useState(1)
  const [address, setAddress] = useState(EMPTY_ADDRESS)
  const [fieldErrors, setFieldErrors] = useState({})
  const [offeringId, setOfferingId] = useState(null)
  const [catalog, setCatalog] = useState({ offerings: [], unreadable: false, loading: false, error: null })
  const [quote, setQuote] = useState(null)
  const [quoteError, setQuoteError] = useState(null)
  const [orderError, setOrderError] = useState(null)
  const [placed, setPlaced] = useState(null)
  const [downloaded, setDownloaded] = useState(null)
  const [placing, setPlacing] = useState(false)

  const {
    status, progress, preflight, error, analyze, createPrintFile, downloadPrintFile, uploadForPrinter, reset, busy,
  } = useScrapbookPrint(pages, { formatId, productId: DEFAULT_PRODUCT_ID })
  const { createOrder } = usePrintOrders(scrapbookId)

  const format = getFormat(formatId)
  const product = getProduct(DEFAULT_PRODUCT_ID)
  const plan = preflight?.plan
  const needsPadding = (plan?.pagesToAdd || 0) > 0
  const blocked = preflight ? !preflight.ok : false
  const finalPageCount = plan?.target ?? pages.length

  // DPI and the safe area are both functions of how big the page is, so a book
  // that passes at 20 × 15 can fail at 28 × 21. Re-check on every change.
  useEffect(() => {
    setDownloaded(null)
    reset()
    analyze()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatId])

  // The catalogue is the only source of an offering id, so ordering cannot
  // start without it. Fetched once the user moves past the preflight, not on
  // open: most people who build a print file are not buying one that minute.
  useEffect(() => {
    if (step !== 'details' || catalog.offerings.length || catalog.loading) return
    let cancelled = false
    setCatalog((c) => ({ ...c, loading: true, error: null }))
    fetchOfferings(user)
      .then(({ offerings: raw }) => {
        if (cancelled) return
        const parsed = normalizeOfferings(raw)
        setCatalog({ ...parsed, loading: false, error: null })
      })
      .catch((err) => {
        if (cancelled) return
        devError('Failed to load print catalogue', err)
        setCatalog({ offerings: [], unreadable: false, loading: false, error: err })
      })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const available = useMemo(
    () => offeringsForFormat(catalog.offerings, format),
    [catalog.offerings, format]
  )

  useEffect(() => {
    if (!offeringId && available.length === 1) setOfferingId(available[0].id)
  }, [available, offeringId])

  const progressLabel = () => {
    if (!progress) return null
    if (progress.phase === 'images') return t('print.progress.photos', { done: progress.done, total: progress.total })
    if (progress.phase === 'pages') return t('print.progress.pages', { done: progress.done, total: progress.total })
    if (progress.phase === 'upload') return t('print.progress.upload', {
      done: formatBytes(progress.done), total: formatBytes(progress.total),
    })
    return null
  }

  const handleDownload = async () => {
    const result = await downloadPrintFile({ title, padPages: needsPadding })
    if (result) setDownloaded(result)
  }

  const goToReview = async () => {
    const errors = addressErrors(address)
    setFieldErrors(errors)
    if (Object.keys(errors).length) return
    if (!offeringId) return

    setStep('review')
    setQuote(null)
    setQuoteError(null)
    try {
      const result = await fetchQuote(user, {
        offeringId, quantity, pageCount: finalPageCount, countryCode: address.countryCode,
      })
      setQuote(result.price)
    } catch (err) {
      devError('Quote failed', err)
      setQuoteError(err)
    }
  }

  /**
   * Render, upload, record, order — in that order, and stopping at the first
   * failure. The upload happens here rather than earlier so that a plaintext
   * PDF only ever reaches storage when somebody has actually decided to buy.
   */
  const handlePlaceOrder = async () => {
    setPlacing(true)
    setOrderError(null)
    try {
      const rendered = await createPrintFile({ padPages: needsPadding })
      if (!rendered) throw new Error('render failed')

      const uploaded = await uploadForPrinter({ scrapbookId, title, blob: rendered.blob })
      if (!uploaded) throw new Error('upload failed')

      const order = await createOrder({
        fileUrl: uploaded.url,
        printFilePath: uploaded.path,
        offeringId,
        formatId,
        productId: DEFAULT_PRODUCT_ID,
        quantity,
        pageCount: assemblePrintPages(pages, product).pages.length,
        widthMm: format.widthMm,
        heightMm: format.heightMm,
        address,
      })

      setPlaced(order)
      setStep('done')
    } catch (err) {
      devError('Order failed', err)
      setOrderError(err)
    } finally {
      setPlacing(false)
    }
  }

  const working = busy || placing

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={working ? undefined : onClose} />
      <div className="relative bg-warm-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-cream-dark flex-shrink-0">
          <h2 className="text-lg font-bold text-bark flex items-center gap-2">
            {step !== 'check' && step !== 'done' && (
              <button
                onClick={() => setStep(step === 'review' ? 'details' : 'check')}
                disabled={working}
                className="text-bark-muted hover:text-bark disabled:opacity-30"
                aria-label={t('print.back')}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <Printer className="w-5 h-5 text-kaydo" />
            {t(`print.steps.${step}`)}
          </h2>
          <button onClick={onClose} disabled={working} className="text-bark-muted hover:text-bark disabled:opacity-30">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {step === 'check' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-bark-muted mb-2">{t('print.formatLabel')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {PRINT_FORMATS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFormatId(f.id)}
                      disabled={working}
                      className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                        formatId === f.id
                          ? 'border-kaydo bg-kaydo/10 text-bark'
                          : 'border-cream-dark bg-cream text-bark-muted hover:text-bark'
                      }`}
                    >
                      {t(f.labelKey)}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-bark-muted mt-2">{t('print.formatHint')}</p>
              </div>

              {status === 'analyzing' && (
                <div className="flex items-center gap-2 text-sm text-bark-muted">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {progressLabel() || t('print.progress.analyzing')}
                </div>
              )}

              {preflight && status !== 'analyzing' && (
                preflight.issues.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-bark">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    {t('print.allClear')}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {preflight.issues.map((issue, i) => (
                      <IssueRow key={`${issue.code}-${issue.elementId || i}`} issue={issue} t={t} />
                    ))}
                  </ul>
                )
              )}

              {status === 'rendering' && (
                <div className="flex items-center gap-2 text-sm text-bark-muted">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {progressLabel() || t('print.progress.rendering')}
                </div>
              )}

              {downloaded && (
                <div className="rounded-lg bg-cream p-3 text-xs text-bark space-y-1">
                  <p className="font-semibold">{t('print.done')}</p>
                  <p className="text-bark-muted">
                    {t('print.doneDetail', {
                      pages: downloaded.pageCount,
                      size: formatBytes(downloaded.blob?.size),
                      width: downloaded.format.widthMm / 10,
                      height: downloaded.format.heightMm / 10,
                    })}
                  </p>
                </div>
              )}

              {error && <p className="text-xs text-red-600">{t('print.failed')}</p>}
            </>
          )}

          {step === 'details' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-bark-muted mb-2">{t('print.productLabel')}</label>
                {catalog.loading && (
                  <p className="flex items-center gap-2 text-sm text-bark-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />{t('print.catalogLoading')}
                  </p>
                )}
                {catalog.error && (
                  <p className="text-xs text-red-600">{t(printErrorKey(catalog.error))}</p>
                )}
                {catalog.unreadable && (
                  <p className="text-xs text-red-600">{t('print.catalogUnreadable')}</p>
                )}
                {!catalog.loading && !catalog.error && !catalog.unreadable && available.length === 0 && (
                  <p className="text-xs text-amber-700">{t('print.catalogEmpty')}</p>
                )}
                {available.length > 0 && (
                  <select
                    value={offeringId ?? ''}
                    onChange={(e) => setOfferingId(e.target.value)}
                    disabled={working}
                    className="w-full rounded-lg px-2.5 py-1.5 text-sm text-bark bg-cream border border-cream-dark focus:border-kaydo outline-none"
                  >
                    <option value="" disabled>{t('print.chooseProduct')}</option>
                    {available.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label htmlFor="print-quantity" className="block text-xs font-semibold text-bark-muted mb-1">
                  {t('print.quantityLabel')}
                </label>
                <input
                  id="print-quantity"
                  type="number"
                  min={1}
                  max={20}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                  disabled={working}
                  className="w-24 rounded-lg px-2.5 py-1.5 text-sm text-bark bg-cream border border-cream-dark focus:border-kaydo outline-none"
                />
              </div>

              <div>
                <p className="text-xs font-semibold text-bark-muted mb-2">{t('print.address.heading')}</p>
                <PrintAddressForm
                  address={address}
                  onChange={setAddress}
                  errors={fieldErrors}
                  disabled={working}
                />
                <p className="text-[11px] text-bark-muted mt-2">{t('print.address.privacyNote')}</p>
              </div>
            </>
          )}

          {step === 'review' && (
            <>
              <dl className="text-xs text-bark space-y-1.5">
                <div className="flex justify-between"><dt className="text-bark-muted">{t('print.review.book')}</dt><dd>{title}</dd></div>
                <div className="flex justify-between"><dt className="text-bark-muted">{t('print.review.format')}</dt><dd>{t(format.labelKey)}</dd></div>
                <div className="flex justify-between"><dt className="text-bark-muted">{t('print.review.pages')}</dt><dd>{finalPageCount}</dd></div>
                <div className="flex justify-between"><dt className="text-bark-muted">{t('print.review.quantity')}</dt><dd>{quantity}</dd></div>
                <div className="flex justify-between gap-4">
                  <dt className="text-bark-muted flex-shrink-0">{t('print.review.shipTo')}</dt>
                  <dd className="text-right">{address.name}, {address.postalCode} {address.city}, {address.countryCode}</dd>
                </div>
              </dl>

              <div className="rounded-lg bg-cream p-3">
                {!quote && !quoteError && (
                  <p className="flex items-center gap-2 text-sm text-bark-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />{t('print.quoteLoading')}
                  </p>
                )}
                {quoteError && <p className="text-xs text-red-600">{t(printErrorKey(quoteError))}</p>}
                {quote && (
                  <pre className="text-[11px] text-bark whitespace-pre-wrap break-words">
                    {JSON.stringify(quote, null, 2)}
                  </pre>
                )}
              </div>

              {needsPadding && (
                <p className="text-[11px] text-bark-muted">
                  {t('print.paddingQuestion', { add: plan.pagesToAdd, target: plan.target })}
                </p>
              )}

              {placing && (
                <div className="flex items-center gap-2 text-sm text-bark-muted">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {progressLabel() || t('print.progress.placing')}
                </div>
              )}

              {orderError && <p className="text-xs text-red-600">{t(printErrorKey(orderError))}</p>}
            </>
          )}

          {step === 'done' && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm text-bark">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                {t('print.placed.heading')}
              </p>
              <p className="text-xs text-bark-muted">{t('print.placed.body')}</p>
              <p className="text-xs text-bark">
                {t('print.placed.reference')}: <code className="font-mono">{placed?.orderReference}</code>
              </p>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-cream-dark flex-shrink-0 space-y-2">
          {step === 'check' && (
            <>
              {needsPadding && !blocked && (
                <p className="text-xs text-bark-muted">
                  {t('print.paddingQuestion', { add: plan.pagesToAdd, target: plan.target })}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  disabled={working || blocked || !preflight}
                  className="flex-1 px-3 py-2 rounded-lg bg-cream hover:bg-cream-dark text-bark text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {t('print.downloadOnly')}
                </button>
                <button
                  onClick={() => setStep('details')}
                  disabled={working || blocked || !preflight || !familyId}
                  className="flex-1 px-3 py-2 rounded-lg bg-kaydo hover:bg-kaydo-dark text-white text-sm font-medium disabled:opacity-40"
                >
                  {t('print.orderIt')}
                </button>
              </div>
              {blocked && (
                <p className="text-[11px] text-red-600">
                  {t(preflight.errors.some((e) => e.code === ISSUE.TOO_MANY_PAGES)
                    ? 'print.blockedTooManyPages'
                    : 'print.blocked')}
                </p>
              )}
            </>
          )}

          {step === 'details' && (
            <button
              onClick={goToReview}
              disabled={working || !offeringId}
              className="w-full px-3 py-2 rounded-lg bg-kaydo hover:bg-kaydo-dark text-white text-sm font-medium disabled:opacity-40"
            >
              {t('print.continue')}
            </button>
          )}

          {step === 'review' && (
            <>
              <button
                onClick={handlePlaceOrder}
                disabled={working || !quote}
                className="w-full px-3 py-2 rounded-lg bg-kaydo hover:bg-kaydo-dark text-white text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                {placing && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('print.placeOrder')}
              </button>
              <p className="text-[11px] text-bark-muted text-center">{t('print.placeOrderNote')}</p>
            </>
          )}

          {step === 'done' && (
            <button
              onClick={onClose}
              className="w-full px-3 py-2 rounded-lg bg-cream hover:bg-cream-dark text-bark text-sm font-medium"
            >
              {t('print.close')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

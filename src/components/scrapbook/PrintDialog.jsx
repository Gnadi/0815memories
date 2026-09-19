import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Loader2, AlertTriangle, AlertCircle, Info, CheckCircle2, Printer } from 'lucide-react'
import { useScrapbookPrint } from '../../hooks/useScrapbookPrint'
import { ISSUE, LEVEL } from '../../utils/printPreflight'
import { PRINT_FORMATS, DEFAULT_FORMAT_ID, DEFAULT_PRODUCT_ID } from '../../utils/printFormats'

const LEVEL_ICON = {
  [LEVEL.ERROR]: AlertCircle,
  [LEVEL.WARNING]: AlertTriangle,
  [LEVEL.DECISION]: Info,
}

const LEVEL_CLASS = {
  [LEVEL.ERROR]: 'text-red-600',
  [LEVEL.WARNING]: 'text-amber-600',
  [LEVEL.DECISION]: 'text-bark-muted',
}

function formatBytes(bytes) {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`
}

/**
 * One issue, in the user's language, naming the page it is on.
 *
 * Every message has to be actionable: "page 4's photo prints at 90 DPI" is
 * something a person can fix; "resolution warning" is something they click past.
 */
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
 * The step between a scrapbook and a printed book.
 *
 * It exists because the failure modes of printing are invisible on screen: a
 * photo that looks sharp at 800 px is soft at 28 cm, a title that sits nicely
 * near the edge is trimmed off, and a six-page book cannot be bound at all.
 * Nothing here is a confirmation prompt — each line is a thing the user can go
 * back and change while changing it is still free.
 */
export default function PrintDialog({ pages, title, onClose }) {
  const { t } = useTranslation('scrapbook')
  const [formatId, setFormatId] = useState(DEFAULT_FORMAT_ID)
  const [result, setResult] = useState(null)

  const {
    status, progress, preflight, error, analyze, downloadPrintFile, reset, busy,
  } = useScrapbookPrint(pages, { formatId, productId: DEFAULT_PRODUCT_ID })

  // Re-check whenever the physical size changes: DPI and the safe area are both
  // functions of how big the page is, so a book that is fine at 20 × 15 cm can
  // fail at 28 × 21.
  useEffect(() => {
    setResult(null)
    reset()
    analyze()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatId])

  const plan = preflight?.plan
  const needsPadding = (plan?.pagesToAdd || 0) > 0
  const blocked = preflight ? !preflight.ok : false

  const handleDownload = async (padPages) => {
    const rendered = await downloadPrintFile({ title, padPages })
    if (rendered) setResult(rendered)
  }

  const progressLabel = () => {
    if (!progress) return null
    if (progress.phase === 'images') return t('print.progress.photos', { done: progress.done, total: progress.total })
    if (progress.phase === 'pages') return t('print.progress.pages', { done: progress.done, total: progress.total })
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={busy ? undefined : onClose} />
      <div className="relative bg-warm-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-cream-dark flex-shrink-0">
          <h2 className="text-lg font-bold text-bark flex items-center gap-2">
            <Printer className="w-5 h-5 text-kaydo" />
            {t('print.title')}
          </h2>
          <button onClick={onClose} disabled={busy} className="text-bark-muted hover:text-bark disabled:opacity-30">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-bark-muted mb-2">{t('print.formatLabel')}</label>
            <div className="grid grid-cols-2 gap-2">
              {PRINT_FORMATS.map((format) => (
                <button
                  key={format.id}
                  onClick={() => setFormatId(format.id)}
                  disabled={busy}
                  className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                    formatId === format.id
                      ? 'border-kaydo bg-kaydo/10 text-bark'
                      : 'border-cream-dark bg-cream text-bark-muted hover:text-bark'
                  }`}
                >
                  {t(format.labelKey)}
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
            <div className="space-y-4">
              {preflight.issues.length === 0 ? (
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
              )}
            </div>
          )}

          {status === 'rendering' && (
            <div className="flex items-center gap-2 text-sm text-bark-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              {progressLabel() || t('print.progress.rendering')}
            </div>
          )}

          {result && (
            <div className="rounded-lg bg-cream p-3 text-xs text-bark space-y-1">
              <p className="font-semibold">{t('print.done')}</p>
              <p className="text-bark-muted">
                {t('print.doneDetail', {
                  pages: result.pageCount,
                  size: formatBytes(result.blob?.size),
                  width: result.format.widthMm / 10,
                  height: result.format.heightMm / 10,
                })}
              </p>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{t('print.failed')}</p>}
        </div>

        <div className="p-5 border-t border-cream-dark flex-shrink-0 space-y-2">
          {/* The page-count question, asked rather than answered for them. A book
              padded to 24 pages without being told is a surprise in the post. */}
          {needsPadding && !blocked && (
            <p className="text-xs text-bark-muted">
              {t('print.paddingQuestion', { add: plan.pagesToAdd, target: plan.target })}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={busy}
              className="flex-1 px-3 py-2 rounded-lg bg-cream hover:bg-cream-dark text-bark text-sm font-medium disabled:opacity-50"
            >
              {needsPadding && !blocked ? t('print.keepEditing') : t('print.close')}
            </button>
            <button
              onClick={() => handleDownload(needsPadding)}
              disabled={busy || blocked || !preflight}
              className="flex-1 px-3 py-2 rounded-lg bg-kaydo hover:bg-kaydo-dark text-white text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-1.5"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {needsPadding && !blocked ? t('print.padAndBuild', { add: plan.pagesToAdd }) : t('print.build')}
            </button>
          </div>

          {blocked && (
            <p className="text-[11px] text-red-600">
              {t(preflight.errors.some((e) => e.code === ISSUE.TOO_MANY_PAGES)
                ? 'print.blockedTooManyPages'
                : 'print.blocked')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

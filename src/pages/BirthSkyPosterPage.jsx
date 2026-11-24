import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Download, FileDown, Printer, Info } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import useSkyPoster from '../hooks/useSkyPoster'
import { formatWallDate, posterLanguage } from '../utils/sky/caption'
import { clearSkyDraft, loadSkyDraft } from '../utils/sky/skyDraft'
import {
  downloadPosterPdf,
  downloadPosterPng,
  posterFileBase,
  renderPosterPrintFile,
} from '../utils/sky/posterExport'
import { printConfig } from '../utils/printBook'
import PosterOrderModal from '../components/sky/PosterOrderModal'
import {
  SkyCaptionSection,
  SkyExportButton,
  SkyPosterPreview,
  SkyStyleSection,
  skySectionClass,
} from '../components/sky/SkyPosterParts'
import Sidebar from '../components/layout/Sidebar'
import { devError } from '../utils/devLog'

const PRINTING_ENABLED = printConfig().enabled

/**
 * A birth sky made on the public page and kept for the poster only: the
 * child is not added to the family (BirthSkyContinuePage offers the choice),
 * because the poster is a gift for someone else's child, say.
 *
 * Nothing about the birth is stored in Firestore, then. The details stay in
 * this browser's draft (utils/sky/skyDraft.js) until Peecho's checkout is
 * open, and are deleted then; the print file itself is the one unencrypted
 * copy, as for every ordered print, and the order dialog says so.
 */
export default function BirthSkyPosterPage() {
  const { t, i18n } = useTranslation('sky')
  const lang = posterLanguage(i18n.language)
  const navigate = useNavigate()
  const { familyId } = useAuth()
  // Read once: the draft is deleted when the order is under way.
  const [draft] = useState(() => loadSkyDraft())
  const [form, setForm] = useState(() =>
    draft
      ? {
        birthTime: draft.birthTime,
        birthPlace: draft.birthPlace,
        skyStyle: draft.skyStyle,
        title: draft.title || draft.name,
        dedication: draft.dedication,
      }
      : null,
  )
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [orderOpen, setOrderOpen] = useState(() => PRINTING_ENABLED && draft?.order === true)

  const dateStr = draft?.birthDate ?? null
  const { catalog, catalogError, sky, canvasRef, optionsFor } = useSkyPoster({ form, dateStr, lang, t })

  if (!draft) return <Navigate to="/home" replace />

  const update = (patch) => setForm((f) => ({ ...f, ...patch }))
  const posterOptions = () => optionsFor(form.title, form.dedication)
  const fileBase = posterFileBase(t('export.fileName'), form.title)

  const run = async (kind, task) => {
    setBusy(kind)
    setError(null)
    try {
      // Let the button show its busy state before the heavy canvas work blocks the thread.
      await new Promise((r) => setTimeout(r, 30))
      await task()
    } catch (err) {
      devError(`Sky export (${kind}) failed`, err)
      setError(t('export.error'))
    } finally {
      setBusy(null)
    }
  }

  const handleDiscard = () => {
    clearSkyDraft()
    navigate('/home', { replace: true })
  }

  const canExport = Boolean(sky) && !busy
  const place = draft.birthPlace.name

  return (
    <div className="min-h-screen bg-cream flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-20 lg:pb-0">
        <div className="sticky top-0 z-20 bg-cream border-b border-cream-dark px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/home')} className="text-bark-muted hover:text-bark" aria-label={t('back')}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-bold text-bark truncate">{t('title')}</h1>
            <p className="text-xs text-bark-muted truncate">{t('subtitle', { name: draft.name })}</p>
          </div>
        </div>

        <div className="p-4 md:p-8 lg:pt-4 w-full max-w-7xl mx-auto grid gap-6 lg:gap-10 md:grid-cols-[minmax(0,1fr)_320px] lg:grid-cols-[minmax(0,1fr)_340px]">
          <SkyPosterPreview
            canvasRef={canvasRef}
            sky={sky}
            catalog={catalog}
            catalogError={catalogError}
            label={t('subtitle', { name: draft.name })}
          />

          <div className="flex flex-col gap-5">
            <section className={skySectionClass}>
              <h2 className="font-semibold text-bark">{t('details.heading')}</h2>
              <p className="text-sm text-bark">
                {t('continue.summary', { name: draft.name, date: formatWallDate(draft.birthDate, lang), place })}
                {draft.birthTime ? ` · ${draft.birthTime}` : ''}
              </p>
              <p className="flex gap-1.5 text-[11px] text-bark-muted">
                <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                {t('posterOnly.notStored')}
              </p>
            </section>

            <SkyStyleSection value={form.skyStyle} onChange={(skyStyle) => update({ skyStyle })} />

            <SkyCaptionSection title={form.title} dedication={form.dedication} onChange={update} />

            {PRINTING_ENABLED && (
              <section className={skySectionClass}>
                <h2 className="font-semibold text-bark">{t('order.heading')}</h2>
                <p className="text-xs text-bark-muted">{t('order.teaser')}</p>
                <button
                  onClick={() => setOrderOpen(true)}
                  disabled={!sky || Boolean(busy)}
                  className="btn-kaydo w-full text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  {t('order.button')}
                </button>
              </section>
            )}

            <section className="bg-warm-white rounded-2xl p-4 shadow-sm border border-cream-dark space-y-2">
              <h2 className="font-semibold text-bark">{t('export.heading')}</h2>
              {[
                { kind: 'png', label: t('export.png'), icon: Download, onClick: () => run('png', () => downloadPosterPng(posterOptions(), fileBase)) },
                { kind: 'a4', label: t('export.pdfA4'), icon: FileDown, onClick: () => run('a4', () => downloadPosterPdf(posterOptions(), fileBase, 'a4')) },
                { kind: 'a3', label: t('export.pdfA3'), icon: FileDown, onClick: () => run('a3', () => downloadPosterPdf(posterOptions(), fileBase, 'a3')) },
              ].map(({ kind, label, icon, onClick }) => (
                <SkyExportButton
                  key={kind}
                  kind={kind}
                  busy={busy}
                  disabled={!canExport}
                  label={label}
                  busyLabel={t('export.rendering')}
                  icon={icon}
                  onClick={onClick}
                />
              ))}
              {error && <p className="text-xs text-red-500">{error}</p>}
            </section>

            <button onClick={handleDiscard} className="text-sm font-medium text-bark-muted hover:text-bark py-2">
              {t('posterOnly.discard')}
            </button>
          </div>
        </div>
      </div>

      {orderOpen && (
        <PosterOrderModal
          familyId={familyId}
          title={form.title || draft.name}
          ready={Boolean(sky)}
          onRender={() => renderPosterPrintFile(posterOptions())}
          // Once the checkout is open, the print file holds the poster and the
          // browser's copy of the details has done its job. Not sooner: if
          // the checkout fails, the poster can still be ordered later.
          onCheckoutReady={clearSkyDraft}
          onClose={() => setOrderOpen(false)}
        />
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Download, FileDown, Send, Loader2, Check, Lock, Printer } from 'lucide-react'
import { Timestamp } from '../config/firestore'
import { useAuth } from '../context/AuthContext'
import { useKids } from '../hooks/useKids'
import { useMemoryWriter } from '../hooks/useMemories'
import useSkyPoster from '../hooks/useSkyPoster'
import { encryptAndUploadWithThumb } from '../utils/encryptedUpload'
import { SKY_STYLES, renderSkyPosterCanvas } from '../utils/sky/skyRenderer'
import { birthDateString, formatWallDate, posterLanguage } from '../utils/sky/caption'
import {
  canvasToBlob,
  downloadPosterPdf,
  downloadPosterPng,
  posterFileBase,
  renderPosterPrintFile,
} from '../utils/sky/posterExport'
import { printConfig } from '../utils/printBook'
import PlacePicker from '../components/sky/PlacePicker'
import PosterOrderModal from '../components/sky/PosterOrderModal'
import {
  SkyCaptionSection,
  SkyExportButton,
  SkyPosterPreview,
  SkyStyleSection,
  skyInputClass,
  skySectionClass,
} from '../components/sky/SkyPosterParts'
import Sidebar from '../components/layout/Sidebar'
import { devError } from '../utils/devLog'

const FEED_WIDTH = 1600

// Ordering is on when the deployment has turned it on (VITE_PEECHO_ENABLED),
// as for printed books.
const PRINTING_ENABLED = printConfig().enabled

export default function BirthSkyPage() {
  const { t, i18n } = useTranslation('sky')
  const lang = posterLanguage(i18n.language)
  const { familyId, encryptionKey } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { childId } = useParams()
  const { kids, loading: kidsLoading, updateKid } = useKids(familyId, encryptionKey)
  const { addMemory } = useMemoryWriter(familyId, encryptionKey)
  const kid = kids.find((k) => k.id === childId)

  // Handed over by BirthSkyContinuePage: the caption of a poster made on the
  // public page, which the child's record does not keep, and whether it was
  // made to be ordered.
  const handedOver = location.state?.skyPoster
  const [form, setForm] = useState(null)
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [orderOpen, setOrderOpen] = useState(() => PRINTING_ENABLED && handedOver?.order === true)

  // The form starts from the saved record once it has arrived, and only then —
  // a snapshot update while someone is typing must not throw their edits away.
  useEffect(() => {
    if (kid && !form) {
      setForm({
        birthTime: kid.birthTime || '',
        birthPlace: kid.birthPlace || null,
        skyStyle: SKY_STYLES[kid.skyStyle] ? kid.skyStyle : 'midnight',
        title: typeof handedOver?.title === 'string' ? handedOver.title : kid.name || '',
        dedication: typeof handedOver?.dedication === 'string' ? handedOver.dedication : '',
      })
    }
  }, [kid, form, handedOver])

  // A string, as the React Compiler can see: from an unknown function it would
  // take the result for an object a later call might change, and give up the
  // memoization of the sky and poster below.
  const birthDay = birthDateString(kid?.birthdate)
  const dateStr = birthDay ? String(birthDay) : null

  const { catalog, catalogError, sky, canvasRef, optionsFor } = useSkyPoster({ form, dateStr, lang, t })

  const posterOptions = () => optionsFor(form?.title, form?.dedication)

  const dirty =
    kid &&
    form &&
    ((kid.birthTime || '') !== form.birthTime ||
      JSON.stringify(kid.birthPlace || null) !== JSON.stringify(form.birthPlace) ||
      (kid.skyStyle || 'midnight') !== form.skyStyle)

  const update = (patch) => {
    setForm((f) => ({ ...f, ...patch }))
    setSaveState('idle')
  }

  const handleSave = async () => {
    setSaveState('saving')
    try {
      await updateKid(kid.id, {
        // null clears what is no longer known (services/kids.js).
        birthTime: form.birthTime || null,
        birthPlace: form.birthPlace || null,
        skyStyle: form.skyStyle,
      })
      setSaveState('saved')
    } catch (err) {
      devError('Failed to save birth details', err)
      setSaveState('error')
    }
  }

  const fileBase = posterFileBase(t('export.fileName'), form?.title)

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

  const handlePng = () => run('png', () => downloadPosterPng(posterOptions(), fileBase))

  const handlePdf = (format) => run(format, () => downloadPosterPdf(posterOptions(), fileBase, format))

  const handlePost = () =>
    run('post', async () => {
      const canvas = renderSkyPosterCanvas(FEED_WIDTH, posterOptions())
      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92)
      const file = new File([blob], 'sky-of-birth.jpg', { type: 'image/jpeg' })
      const { url, thumbUrl } = await encryptAndUploadWithThumb(file, encryptionKey)
      await addMemory({
        title: t('export.feedTitle', { name: form.title || kid.name }),
        content: '',
        category: 'sky',
        images: [url],
        ...(thumbUrl ? { thumbs: [thumbUrl] } : {}),
        imageUrl: url,
        date: kid.birthdate || Timestamp.now(),
        voiceMemos: [],
        videos: [],
      })
      navigate('/home')
    })

  if (kidsLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-kaydo" />
      </div>
    )
  }

  if (!kid) return <Navigate to="/journal" replace />

  const canExport = Boolean(sky) && !busy

  return (
    <div className="min-h-screen bg-cream flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen pb-20 lg:pb-0">
        <div className="sticky top-0 z-20 bg-cream border-b border-cream-dark px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(`/journal/${childId}`)}
            className="text-bark-muted hover:text-bark"
            aria-label={t('back')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-bold text-bark truncate">{t('title')}</h1>
            <p className="text-xs text-bark-muted truncate">{t('subtitle', { name: kid.name })}</p>
          </div>
        </div>

        <div className="p-4 md:p-8 lg:pt-4 w-full max-w-7xl mx-auto grid gap-6 lg:gap-10 md:grid-cols-[minmax(0,1fr)_320px] lg:grid-cols-[minmax(0,1fr)_340px]">
          <SkyPosterPreview
            canvasRef={canvasRef}
            sky={sky}
            catalog={catalog}
            catalogError={catalogError}
            label={t('subtitle', { name: kid.name })}
          />

          {/* Controls */}
          {form && (
            <div className="flex flex-col gap-5">
              <section className={skySectionClass}>
                <h2 className="font-semibold text-bark">{t('details.heading')}</h2>
                <div>
                  <p className="text-xs font-medium text-bark-muted mb-1">{t('details.date')}</p>
                  <p className="text-sm text-bark">{dateStr ? formatWallDate(dateStr, lang) : '—'}</p>
                </div>
                <div>
                  <label htmlFor="birth-time" className="block text-xs font-medium text-bark-muted mb-1">
                    {t('details.time')}
                  </label>
                  <input
                    id="birth-time"
                    type="time"
                    value={form.birthTime}
                    onChange={(e) => update({ birthTime: e.target.value })}
                    className={skyInputClass}
                  />
                  <p className="text-[11px] text-bark-muted mt-1">{t('details.timeHint')}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-bark-muted mb-1">{t('details.place')}</p>
                  <PlacePicker value={form.birthPlace} onChange={(birthPlace) => update({ birthPlace })} />
                </div>
                <p className="flex gap-1.5 text-[11px] text-bark-muted">
                  <Lock className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  {t('details.privacy')}
                </p>
                <button
                  onClick={handleSave}
                  disabled={!dirty || saveState === 'saving'}
                  className="btn-kaydo w-full text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saveState === 'saving' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> {t('details.saving')}
                    </>
                  ) : saveState === 'saved' && !dirty ? (
                    <>
                      <Check className="w-4 h-4" /> {t('details.saved')}
                    </>
                  ) : (
                    t('details.save')
                  )}
                </button>
                {saveState === 'error' && <p className="text-xs text-red-500">{t('details.saveError')}</p>}
              </section>

              <SkyStyleSection value={form.skyStyle} onChange={(skyStyle) => update({ skyStyle })} />

              <SkyCaptionSection
                title={form.title}
                dedication={form.dedication}
                onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
              />

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
                  { kind: 'png', label: t('export.png'), icon: Download, onClick: handlePng },
                  { kind: 'a4', label: t('export.pdfA4'), icon: FileDown, onClick: () => handlePdf('a4') },
                  { kind: 'a3', label: t('export.pdfA3'), icon: FileDown, onClick: () => handlePdf('a3') },
                  { kind: 'post', label: t('export.post'), icon: Send, onClick: handlePost },
                ].map(({ kind, label, icon, onClick }) => (
                  <SkyExportButton
                    key={kind}
                    kind={kind}
                    busy={busy}
                    disabled={!canExport}
                    label={label}
                    busyLabel={kind === 'post' ? t('export.posting') : t('export.rendering')}
                    icon={icon}
                    onClick={onClick}
                  />
                ))}
                {error && <p className="text-xs text-red-500">{error}</p>}
              </section>
            </div>
          )}
        </div>
      </div>

      {orderOpen && (
        <PosterOrderModal
          familyId={familyId}
          title={form?.title || kid.name}
          ready={Boolean(sky)}
          onRender={() => renderPosterPrintFile(posterOptions())}
          onClose={() => setOrderOpen(false)}
        />
      )}
    </div>
  )
}

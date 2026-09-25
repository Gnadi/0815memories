import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Download, FileDown, Send, Loader2, Check, Lock } from 'lucide-react'
import { Timestamp, deleteField } from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'
import { useKids } from '../hooks/useKids'
import { useMemoryWriter } from '../hooks/useMemories'
import { encryptAndUploadWithThumb } from '../utils/encryptedUpload'
import { computeSky, zonedTimeToUtc, DEFAULT_NIGHT_TIME } from '../utils/sky/astronomy'
import { loadSkyCatalog } from '../utils/sky/skyData'
import { drawSkyPoster, renderSkyPosterCanvas, POSTER_RATIO, SKY_STYLES } from '../utils/sky/skyRenderer'
import { buildCaption, birthDateString, formatWallDate } from '../utils/sky/caption'
import PlacePicker from '../components/sky/PlacePicker'
import Sidebar from '../components/layout/Sidebar'
import { devError } from '../utils/devLog'

const PREVIEW_WIDTH = 900
// A4 at 300 dpi. A3 at 300 dpi (3508 × 4961) is over the ~16.7 megapixel
// canvas limit of iOS Safari, so A3 renders at 275 dpi — still sharp on paper.
const A4_WIDTH = 2480
const A3_WIDTH = 3210
const FEED_WIDTH = 1600

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))), type, quality)
  })
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  // Revoked on the next tick so the click has taken the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function BirthSkyPage() {
  const { t, i18n } = useTranslation('sky')
  const lang = i18n.language?.startsWith('de') ? 'de' : 'en'
  const { familyId, encryptionKey } = useAuth()
  const navigate = useNavigate()
  const { childId } = useParams()
  const { kids, loading: kidsLoading, updateKid } = useKids(familyId, encryptionKey)
  const { addMemory } = useMemoryWriter(familyId, encryptionKey)
  const kid = kids.find((k) => k.id === childId)

  const [catalog, setCatalog] = useState(null)
  const [catalogError, setCatalogError] = useState(false)
  const [form, setForm] = useState(null)
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [fontsReady, setFontsReady] = useState(false)
  const canvasRef = useRef(null)

  useEffect(() => {
    loadSkyCatalog()
      .then(setCatalog)
      .catch((err) => {
        devError('Failed to load sky catalog', err)
        setCatalogError(true)
      })
    // The poster title uses the self-hosted display font; draw once it is in.
    const fonts = document.fonts
    if (fonts?.load) {
      fonts.load("40px 'Anton'").finally(() => setFontsReady(true))
    } else {
      setFontsReady(true)
    }
  }, [])

  // The form starts from the saved record once it has arrived, and only then —
  // a snapshot update while someone is typing must not throw their edits away.
  useEffect(() => {
    if (kid && !form) {
      setForm({
        birthTime: kid.birthTime || '',
        birthPlace: kid.birthPlace || null,
        skyStyle: SKY_STYLES[kid.skyStyle] ? kid.skyStyle : 'midnight',
        title: kid.name || '',
        dedication: '',
      })
    }
  }, [kid, form])

  const dateStr = birthDateString(kid?.birthdate)

  const sky = useMemo(() => {
    if (!catalog || !dateStr || !form?.birthPlace) return null
    const place = form.birthPlace
    const date = zonedTimeToUtc(dateStr, form.birthTime || DEFAULT_NIGHT_TIME, place.tz)
    return computeSky({ date, lat: place.lat, lon: place.lon, ...catalog })
  }, [catalog, dateStr, form?.birthPlace, form?.birthTime])

  const posterOptions = useMemo(() => {
    if (!form || !dateStr) return null
    return {
      sky,
      style: form.skyStyle,
      lang,
      compass: { n: t('compass.n'), e: t('compass.e'), s: t('compass.s'), w: t('compass.w') },
      planetNames: Object.fromEntries(
        ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].map((b) => [b, t(`planets.${b}`)])
      ),
      caption: buildCaption({
        t,
        lang,
        title: form.title,
        dateStr,
        timeStr: form.birthTime,
        place: form.birthPlace,
        sky,
        dedication: form.dedication,
      }),
    }
  }, [sky, form, dateStr, lang, t])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !posterOptions || !fontsReady) return
    drawSkyPoster(ctx, { ...posterOptions, width: PREVIEW_WIDTH })
  }, [posterOptions, fontsReady])

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
        birthTime: form.birthTime || deleteField(),
        birthPlace: form.birthPlace || deleteField(),
        skyStyle: form.skyStyle,
      })
      setSaveState('saved')
    } catch (err) {
      devError('Failed to save birth details', err)
      setSaveState('error')
    }
  }

  const fileBase = `${t('export.fileName')}-${(form?.title || '').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-') || 'kaydo'}`

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

  const handlePng = () =>
    run('png', async () => {
      const canvas = renderSkyPosterCanvas(A4_WIDTH, posterOptions)
      downloadBlob(await canvasToBlob(canvas, 'image/png'), `${fileBase}.png`)
    })

  const handlePdf = (format) =>
    run(format, async () => {
      const { jsPDF } = await import('jspdf')
      const width = format === 'a3' ? A3_WIDTH : A4_WIDTH
      const canvas = renderSkyPosterCanvas(width, posterOptions)
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageW, Math.min(pageH, pageW * POSTER_RATIO))
      pdf.save(`${fileBase}-${format}.pdf`)
    })

  const handlePost = () =>
    run('post', async () => {
      const canvas = renderSkyPosterCanvas(FEED_WIDTH, posterOptions)
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

  const inputClass =
    'w-full px-3 py-2 border border-cream-dark rounded-xl text-sm bg-cream focus:outline-none focus:ring-2 focus:ring-kaydo/30'

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

        <div className="p-4 md:p-8 w-full max-w-5xl mx-auto grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
          {/* Preview */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-lg border border-cream-dark bg-warm-white">
              <canvas
                ref={canvasRef}
                width={PREVIEW_WIDTH}
                height={Math.round(PREVIEW_WIDTH * POSTER_RATIO)}
                className="block w-full h-auto"
                role="img"
                aria-label={t('subtitle', { name: kid.name })}
              />
              {!sky && (
                <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
                  <p className="text-sm text-bark bg-warm-white/90 rounded-xl px-4 py-3 shadow">
                    {catalogError ? t('loadError') : !catalog ? <Loader2 className="w-5 h-5 animate-spin text-kaydo" /> : t('emptyPreview')}
                  </p>
                </div>
              )}
            </div>
            <p className="text-[11px] text-bark-muted text-center max-w-md">{t('credits')}</p>
          </div>

          {/* Controls */}
          {form && (
            <div className="flex flex-col gap-5">
              <section className="bg-warm-white rounded-2xl p-4 shadow-sm border border-cream-dark space-y-3">
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
                    className={inputClass}
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

              <section className="bg-warm-white rounded-2xl p-4 shadow-sm border border-cream-dark space-y-3">
                <h2 className="font-semibold text-bark">{t('style.heading')}</h2>
                <div className="grid grid-cols-3 gap-2">
                  {Object.keys(SKY_STYLES).map((key) => (
                    <button
                      key={key}
                      onClick={() => update({ skyStyle: key })}
                      aria-pressed={form.skyStyle === key}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border text-xs ${
                        form.skyStyle === key ? 'border-kaydo ring-2 ring-kaydo/30 text-bark' : 'border-cream-dark text-bark-muted'
                      }`}
                    >
                      <span
                        className="w-8 h-8 rounded-full border-2"
                        style={{ background: SKY_STYLES[key].disc, borderColor: SKY_STYLES[key].edge }}
                      />
                      {t(`style.${key}`)}
                    </button>
                  ))}
                </div>
              </section>

              <section className="bg-warm-white rounded-2xl p-4 shadow-sm border border-cream-dark space-y-3">
                <h2 className="font-semibold text-bark">{t('caption.heading')}</h2>
                <div>
                  <label htmlFor="sky-title" className="block text-xs font-medium text-bark-muted mb-1">
                    {t('caption.titleLabel')}
                  </label>
                  <input
                    id="sky-title"
                    type="text"
                    value={form.title}
                    maxLength={40}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="sky-dedication" className="block text-xs font-medium text-bark-muted mb-1">
                    {t('caption.dedicationLabel')}
                  </label>
                  <input
                    id="sky-dedication"
                    type="text"
                    value={form.dedication}
                    maxLength={80}
                    placeholder={t('caption.dedicationPlaceholder')}
                    onChange={(e) => setForm((f) => ({ ...f, dedication: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </section>

              <section className="bg-warm-white rounded-2xl p-4 shadow-sm border border-cream-dark space-y-2">
                <h2 className="font-semibold text-bark">{t('export.heading')}</h2>
                {[
                  { kind: 'png', label: t('export.png'), icon: Download, onClick: handlePng },
                  { kind: 'a4', label: t('export.pdfA4'), icon: FileDown, onClick: () => handlePdf('a4') },
                  { kind: 'a3', label: t('export.pdfA3'), icon: FileDown, onClick: () => handlePdf('a3') },
                  { kind: 'post', label: t('export.post'), icon: Send, onClick: handlePost },
                ].map(({ kind, label, icon: Icon, onClick }) => (
                  <button
                    key={kind}
                    onClick={onClick}
                    disabled={!canExport}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-cream-dark text-sm text-bark hover:bg-cream disabled:opacity-50"
                  >
                    {busy === kind ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4 text-kaydo" />}
                    {busy === kind ? (kind === 'post' ? t('export.posting') : t('export.rendering')) : label}
                  </button>
                ))}
                {error && <p className="text-xs text-red-500">{error}</p>}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

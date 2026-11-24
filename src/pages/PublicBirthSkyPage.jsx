import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Head } from 'vite-react-ssg'
import { I18nextProvider, useTranslation } from 'react-i18next'
import { ChevronDown, Download, FileDown, Lock, Printer, Gift } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import i18n, { LANDING_PATHS, isRtl } from '../i18n'
import { BIRTH_SKY_PATHS, absoluteUrl, alternatesFor } from '../seoRoutes'
import { SCREENSHOTS, screenshotPath, screenshotSize } from '../components/landing/screenshots'
import LanguageSwitcher from '../components/LanguageSwitcher'
import enSky from '../locales/en/sky.json'
import deSky from '../locales/de/sky.json'
import frSky from '../locales/fr/sky.json'
import arSky from '../locales/ar/sky.json'
import useSkyPoster from '../hooks/useSkyPoster'
import { downloadPosterPdf, downloadPosterPng, posterFileBase } from '../utils/sky/posterExport'
import { saveSkyDraft } from '../utils/sky/skyDraft'
import { printConfig } from '../utils/printBook'
import PlacePicker from '../components/sky/PlacePicker'
import {
  SkyCaptionSection,
  SkyExportButton,
  SkyPosterPreview,
  SkyStyleSection,
  skyInputClass,
  skySectionClass,
} from '../components/sky/SkyPosterParts'
import KaydoLogo from '../components/KaydoLogo'
import { devError } from '../utils/devLog'

const PRINTING_ENABLED = printConfig().enabled
const DATE = /^\d{4}-\d{2}-\d{2}$/
const OG_LOCALES = { en: 'en_US', de: 'de_DE', fr: 'fr_FR', ar: 'ar_AR' }

// The birth sky's copy is needed here before the signed-in app's translations
// are, so it travels in this page's chunk, as the feature pages' does. It is
// registered as the module loads: in the Node pre-render the first render is
// synchronous and cannot wait for anything.
for (const [lng, bundle] of [['en', enSky], ['de', deSky], ['fr', frSky], ['ar', arSky]]) {
  if (!i18n.hasResourceBundle(lng, 'sky')) i18n.addResourceBundle(lng, 'sky', bundle)
}

/**
 * The birth sky for anyone, without an account — the way in from the landing
 * page. A visitor makes the poster of a birth and downloads it for free; to
 * order it as a wall print (or keep it), they sign up, and the new family
 * takes the child over (utils/sky/skyDraft.js, BirthSkyContinuePage).
 *
 * Nothing typed here leaves the browser: the sky is computed and drawn on this
 * device, and places are searched in a bundled list. That is why the page can
 * be public at all — it reads and writes no family's data.
 */
export default function PublicBirthSkyPage({ lng = 'en' }) {
  // The page's address fixes its language (src/seoRoutes.js), as the feature
  // pages' does, so the pre-rendered page and the one the browser hydrates say
  // the same. Its parts — the place picker, the style and caption — read the
  // language from the instance they are given, so they get one fixed to it.
  const scoped = useMemo(() => i18n.cloneInstance({ lng, initAsync: false }), [lng])
  return (
    <I18nextProvider i18n={scoped}>
      <BirthSkyStudio lng={lng} />
    </I18nextProvider>
  )
}

function BirthSkyStudio({ lng }) {
  const { t } = useTranslation('sky')

  // The router keeps the scroll position across pages, and the landing page's
  // link to this one sits far down it: the page opened on its questions
  // rather than its editor.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  const lang = lng
  const navigate = useNavigate()
  const { isAuthenticated, isAdmin, familyId } = useAuth()

  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  // The title follows the name until it is typed into.
  const [titleEdited, setTitleEdited] = useState(false)
  const [form, setForm] = useState({ birthTime: '', birthPlace: null, skyStyle: 'midnight', title: '', dedication: '' })
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [draftError, setDraftError] = useState(false)

  const dateStr = DATE.test(birthDate) ? birthDate : null
  const { catalog, catalogError, sky, canvasRef, optionsFor } = useSkyPoster({ form, dateStr, lang, t })

  const update = (patch) => setForm((f) => ({ ...f, ...patch }))

  const handleName = (value) => {
    setName(value)
    if (!titleEdited) update({ title: value })
  }

  const handleCaption = (patch) => {
    if ('title' in patch) setTitleEdited(true)
    update(patch)
  }

  const fileBase = posterFileBase(t('export.fileName'), form.title)
  const posterOptions = () => optionsFor(form.title, form.dedication)

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

  // Signing up or in, then the family takes the poster over. A signed-in
  // admin goes there at once.
  const keep = (target) => {
    setDraftError(false)
    const saved = saveSkyDraft({
      name: name.trim() || form.title.trim(),
      birthDate: dateStr,
      birthTime: form.birthTime,
      birthPlace: form.birthPlace,
      skyStyle: form.skyStyle,
      title: form.title,
      dedication: form.dedication,
      order: PRINTING_ENABLED,
    })
    if (!saved) {
      setDraftError(true)
      return
    }
    if (isAuthenticated && isAdmin && familyId) navigate('/birth-sky/continue')
    else navigate(target)
  }

  const canExport = Boolean(sky) && !busy
  const canKeep = Boolean(sky) && Boolean(name.trim() || form.title.trim())
  const homePath = LANDING_PATHS[lng] ?? '/'
  const path = BIRTH_SKY_PATHS[lng]
  const poster = SCREENSHOTS.birthSkyPoster
  const example = { src: screenshotPath(poster, lng), ...screenshotSize(poster, lng), alt: t('public.exampleAlt') }
  const sections = t('public.sections', { returnObjects: true })

  // Picking the other language goes to this page in it and carries the choice
  // on into the app; a language without this page goes to its landing page.
  const showLanguage = (next) => {
    i18n.changeLanguage(next)
    const target = BIRTH_SKY_PATHS[next] ?? LANDING_PATHS[next]
    if (target !== path) navigate(target)
  }

  return (
    <div className="min-h-screen bg-cream font-sans flex flex-col">
      <Head>
        <html lang={lng} dir={isRtl(lng) ? 'rtl' : 'ltr'} />
        <title>{t('public.seoTitle')}</title>
        <meta name="description" content={t('public.seoDescription')} />
        <meta name="robots" content="index,follow" />
        <link rel="canonical" href={absoluteUrl(path)} />
        {alternatesFor(path).map(([hrefLang, href]) => (
          <link key={hrefLang} rel="alternate" hrefLang={hrefLang} href={href} />
        ))}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kaydo" />
        <meta property="og:title" content={t('public.seoTitle')} />
        <meta property="og:description" content={t('public.seoDescription')} />
        <meta property="og:url" content={absoluteUrl(path)} />
        <meta property="og:image" content={absoluteUrl(example.src)} />
        <meta property="og:locale" content={OG_LOCALES[lng]} />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>

      <header className="sticky top-0 z-30 bg-cream border-b border-cream-dark">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to={homePath} className="flex items-center gap-2 text-bark font-bold text-lg">
            <KaydoLogo size={22} />
            <span>Kaydo</span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher variant="sidebar" language={lng} onSelect={showLanguage} />
            <Link to="/login?admin=1" className="text-sm font-semibold text-bark-muted hover:text-bark">
              {t('public.login')}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 md:px-8 pt-8 pb-2">
          <h1 className="text-3xl md:text-4xl font-bold text-bark leading-tight">{t('public.heading')}</h1>
          <p className="text-bark-light mt-2 max-w-2xl">{t('public.intro')}</p>
        </div>

        <div className="p-4 md:p-8 lg:pt-4 w-full max-w-7xl mx-auto grid gap-6 lg:gap-10 md:grid-cols-[minmax(0,1fr)_320px] lg:grid-cols-[minmax(0,1fr)_340px]">
          <SkyPosterPreview
            canvasRef={canvasRef}
            sky={sky}
            catalog={catalog}
            catalogError={catalogError}
            label={t('public.previewLabel')}
            placeholder={example}
          />

          <div className="flex flex-col gap-5">
            <section className={skySectionClass}>
              <h2 className="font-semibold text-bark">{t('details.heading')}</h2>
              <div>
                <label htmlFor="sky-name" className="block text-xs font-medium text-bark-muted mb-1">
                  {t('public.name')}
                </label>
                <input
                  id="sky-name"
                  type="text"
                  value={name}
                  maxLength={40}
                  onChange={(e) => handleName(e.target.value)}
                  className={skyInputClass}
                />
              </div>
              <div>
                <label htmlFor="birth-date" className="block text-xs font-medium text-bark-muted mb-1">
                  {t('details.date')}
                </label>
                <input
                  id="birth-date"
                  type="date"
                  value={birthDate}
                  min="1900-01-01"
                  max="2100-12-31"
                  onChange={(e) => setBirthDate(e.target.value)}
                  className={skyInputClass}
                />
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
                {t('public.privacy')}
              </p>
            </section>

            <SkyStyleSection value={form.skyStyle} onChange={(skyStyle) => update({ skyStyle })} />

            <SkyCaptionSection title={form.title} dedication={form.dedication} onChange={handleCaption} />

            <section className="bg-warm-white rounded-2xl p-4 shadow-sm border border-cream-dark space-y-2">
              <h2 className="font-semibold text-bark">{t('public.downloadHeading')}</h2>
              <p className="text-xs text-bark-muted">{t('public.downloadFree')}</p>
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

            <section className="bg-kaydo-dark text-white rounded-2xl p-4 shadow-sm space-y-3">
              <h2 className="font-semibold flex items-center gap-2">
                {PRINTING_ENABLED ? <Printer className="w-4 h-4" /> : <Gift className="w-4 h-4" />}
                {PRINTING_ENABLED ? t('public.orderHeading') : t('public.keepHeading')}
              </h2>
              <p className="text-sm text-white/90">
                {PRINTING_ENABLED ? t('public.orderBody') : t('public.keepBody')}
              </p>
              <button
                type="button"
                onClick={() => keep('/signup')}
                disabled={!canKeep}
                className="w-full px-4 py-2.5 rounded-xl bg-white text-kaydo-dark text-sm font-semibold hover:bg-cream disabled:opacity-60"
              >
                {PRINTING_ENABLED ? t('public.orderButton') : t('public.keepButton')}
              </button>
              {!canKeep && <p className="text-xs text-white/80">{t('public.needsDetails')}</p>}
              {draftError && <p role="alert" className="text-xs text-white">{t('public.draftError')}</p>}
              <p className="text-xs text-white/80">
                {t('public.haveAccount')}{' '}
                <button
                  type="button"
                  onClick={() => keep('/login?admin=1')}
                  disabled={!canKeep}
                  className="underline font-semibold disabled:no-underline"
                >
                  {t('public.loginInstead')}
                </button>
              </p>
            </section>
          </div>
        </div>

        {/* What the poster is, for whoever arrives from a search and wants to
            know before typing anything. Folded like the landing page's FAQ;
            the answers are in the page all the same, for the search engine. */}
        <section className="bg-warm-white py-16 mt-6">
          <div className="max-w-2xl mx-auto px-5">
            <h2 className="text-3xl font-bold text-bark text-center mb-8">{t('public.faqTitle')}</h2>
            <div className="space-y-3">
              {sections.map((section) => (
                <details key={section.heading} className="group bg-cream rounded-2xl px-6 py-4">
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-semibold text-bark [&::-webkit-details-marker]:hidden">
                    {section.heading}
                    <ChevronDown className="w-5 h-5 text-bark-muted flex-shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-bark-light text-sm leading-relaxed mt-3">{paragraph}</p>
                  ))}
                  {section.printParagraph && PRINTING_ENABLED && (
                    <p className="text-bark-light text-sm leading-relaxed mt-3">{section.printParagraph}</p>
                  )}
                </details>
              ))}
            </div>
            <p className="text-sm text-bark-muted text-center mt-8">
              <Link to={homePath} className="underline hover:text-bark">{t('public.moreAboutKaydo')}</Link>
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

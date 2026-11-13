import { Link, useNavigate } from 'react-router-dom'
import { Head } from 'vite-react-ssg'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n, { LANDING_PATHS } from '../i18n'
import KaydoLogo from '../components/KaydoLogo'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { BrowserFrame, PhoneFrame } from '../components/landing/DeviceFrame'
import { SCREENSHOTS, screenshotPath, screenshotSize } from '../components/landing/screenshots'
import { FEATURE_PAGES, absoluteUrl, alternatesFor } from '../seoRoutes'
import { breadcrumbStructuredData } from '../utils/structuredData'
import enFeatures from '../locales/en/features.json'
import deFeatures from '../locales/de/features.json'

// The feature pages' copy is needed by these pages only, so it travels in
// their chunk and not in the startup bundle or the signed-in app's. It is
// registered as the module loads, before the first render: in the Node
// pre-render that render is synchronous and cannot wait for anything.
for (const [lng, bundle] of [['en', enFeatures], ['de', deFeatures]]) {
  if (!i18n.hasResourceBundle(lng, 'features')) i18n.addResourceBundle(lng, 'features', bundle)
}

/**
 * A page about one thing Kaydo does, for people who search for that thing and
 * do not know Kaydo yet (src/seoRoutes.js lists them). `id` names the page and
 * `lng` its language, which its address fixes, as on the landing page.
 */
export default function FeaturePage({ id, lng }) {
  const navigate = useNavigate()
  const { t } = useTranslation('features', { lng })
  const page = FEATURE_PAGES.find((p) => p.id === id)
  const copy = t(`pages.${id}`, { returnObjects: true })
  const path = page.paths[lng]
  const homePath = LANDING_PATHS[lng]
  const others = FEATURE_PAGES.filter((p) => p.id !== id)
  const shot = SCREENSHOTS[page.screenshot]
  const image = { src: screenshotPath(shot, lng), ...screenshotSize(shot, lng), alt: copy.imageAlt }
  const ogImage = absoluteUrl(lng === 'de' ? '/og-image-de.png' : '/og-image.png')

  // Picking the other language goes to this page in it, and carries the
  // choice on into the app, as on the landing page.
  const showLanguage = (next) => {
    i18n.changeLanguage(next)
    // A language without this page, like Arabic, goes to its landing page.
    const target = page.paths[next] ?? LANDING_PATHS[next]
    if (target !== path) navigate(target)
  }

  return (
    <div className="min-h-screen bg-cream font-sans flex flex-col">
      <Head>
        <html lang={lng} />
        <title>{copy.seoTitle}</title>
        <meta name="description" content={copy.seoDescription} />
        <meta name="robots" content="index,follow" />
        <link rel="canonical" href={absoluteUrl(path)} />
        {alternatesFor(path).map(([hrefLang, href]) => (
          <link key={hrefLang} rel="alternate" hrefLang={hrefLang} href={href} />
        ))}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kaydo" />
        <meta property="og:title" content={copy.seoTitle} />
        <meta property="og:description" content={copy.seoDescription} />
        <meta property="og:url" content={absoluteUrl(path)} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:locale" content={lng === 'de' ? 'de_DE' : 'en_US'} />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbStructuredData({ home: t('nav.home'), homePath, name: copy.name, path }))}
        </script>
      </Head>

      <header className="sticky top-0 z-50 bg-cream border-b border-cream-dark">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between gap-3">
          <Link to={homePath} className="flex items-center gap-2 text-bark font-bold text-lg">
            <KaydoLogo size={22} />
            <span>Kaydo</span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher variant="sidebar" language={lng} onSelect={showLanguage} />
            <Link to="/login?admin=1" className="hidden sm:inline-flex btn-kaydo text-sm px-5 py-2">
              {t('nav.login')}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-5 pt-10 pb-16">
          <nav aria-label="Breadcrumb" className="text-sm text-bark-muted mb-8">
            <Link to={homePath} className="hover:text-bark transition-colors">{t('nav.home')}</Link>
            <span aria-hidden="true"> › </span>
            <span aria-current="page">{copy.name}</span>
          </nav>

          <h1 className="text-4xl md:text-5xl font-bold text-bark leading-tight mb-5">{copy.h1}</h1>
          <p className="text-lg text-bark-light leading-relaxed mb-8">{copy.intro}</p>

          <div className="flex flex-wrap gap-3 mb-12">
            <Link to="/demo" className="btn-kaydo text-base px-6 py-3">{t('cta.demo')}</Link>
            <Link
              to="/signup"
              className="px-6 py-3 rounded-full border-2 border-bark-muted text-bark font-semibold hover:border-bark transition-colors text-base"
            >
              {t('cta.getStarted')}
            </Link>
          </div>

          <div className="mb-14">
            {page.frame === 'phone'
              ? <PhoneFrame {...image} statusBar="var(--color-cream)" />
              : <BrowserFrame {...image} sizes="(min-width: 768px) 728px, 100vw" />}
          </div>

          <div className="space-y-10">
            {copy.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-2xl font-bold text-bark mb-3">{section.heading}</h2>
                <div className="space-y-3">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-base text-bark-light leading-relaxed">{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <section className="mt-14 rounded-3xl bg-warm-white border border-cream-dark p-8 text-center">
            <h2 className="text-2xl font-bold text-bark mb-3">{t('cta.title')}</h2>
            <p className="text-bark-light leading-relaxed mb-6 max-w-xl mx-auto">{t('cta.text')}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/demo" className="btn-kaydo text-base px-6 py-3">{t('cta.demo')}</Link>
              <Link
                to="/signup"
                className="px-6 py-3 rounded-full border-2 border-bark-muted text-bark font-semibold hover:border-bark transition-colors text-base"
              >
                {t('cta.getStarted')}
              </Link>
            </div>
          </section>

          <section className="mt-14">
            <h2 className="text-xl font-bold text-bark mb-4">{t('related')}</h2>
            <ul className="space-y-2">
              {others.map((other) => (
                <li key={other.id}>
                  <Link
                    to={other.paths[lng]}
                    className="inline-flex items-center gap-2 font-semibold text-kaydo-dark underline underline-offset-4 hover:text-kaydo transition-colors"
                  >
                    {t(`pages.${other.id}.name`)}
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to={homePath}
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-bark-muted hover:text-bark transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              {t('nav.backHome')}
            </Link>
          </section>
        </article>
      </main>

      <footer className="bg-cream border-t border-cream-dark py-8">
        <div className="max-w-5xl mx-auto px-5 flex flex-col items-center gap-5">
          <nav aria-label={t('nav.features')} className="text-center">
            <p className="text-xs font-bold text-bark-muted tracking-widest uppercase mb-3">{t('nav.features')}</p>
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-bark-light">
              {FEATURE_PAGES.map((p) => (
                <li key={p.id}>
                  <Link to={p.paths[lng]} className="hover:text-bark transition-colors">{t(`pages.${p.id}.name`)}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav className="flex flex-wrap justify-center gap-6 text-xs font-semibold text-bark-muted tracking-wider uppercase">
            <Link to="/terms" className="hover:text-bark transition-colors">{t('footer.terms')}</Link>
            <Link to="/privacy-policy" className="hover:text-bark transition-colors">{t('footer.privacy')}</Link>
            <Link to="/contact" className="hover:text-bark transition-colors">{t('footer.contact')}</Link>
          </nav>
          <p className="flex items-center gap-2 text-xs text-bark-muted">
            <KaydoLogo size={14} />
            {t('footer.copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </footer>
    </div>
  )
}

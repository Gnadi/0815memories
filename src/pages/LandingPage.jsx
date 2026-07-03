import { useNavigate, Link } from 'react-router-dom'
import { Head } from 'vite-react-ssg'
import { useAuth } from '../context/AuthContext'
import {
  Shield,
  Mail,
  Utensils,
  Lock,
  Check,
  Ban,
  X,
  Menu,
  GitFork,
  Star,
  Camera,
  Video,
  Mic,
  KeyRound,
  Scissors,
  Layers,
  Download,
  Search,
  User,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import KaydoLogo from '../components/KaydoLogo'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { BrowserFrame, PhoneFrame } from '../components/landing/DeviceFrame'
import { generateSlug, isSlugAvailable } from '../utils/familySlug'
import usePWAInstall from '../hooks/usePWAInstall'

function OctocatIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.386-1.332-1.755-1.332-1.755-1.09-.745.083-.73.083-.73 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.776.42-1.305.763-1.605-2.665-.3-5.467-1.334-5.467-5.931 0-1.31.468-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.3 1.23A11.5 11.5 0 0 1 12 5.803c1.02.005 2.046.138 3.006.404 2.29-1.552 3.296-1.23 3.296-1.23.653 1.653.243 2.874.12 3.176.77.84 1.235 1.911 1.235 3.221 0 4.61-2.807 5.628-5.48 5.922.43.372.815 1.102.815 2.222 0 1.606-.015 2.898-.015 3.293 0 .322.216.694.825.576C20.565 21.796 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { isAuthenticated, signup, firebaseReady } = useAuth()
  const { t } = useTranslation('landing')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { canInstall, promptInstall } = usePWAInstall()


  return (
    <div className="min-h-screen bg-cream font-sans">
      {/* ── Per-route SEO (pre-rendered into the static HTML of "/") ── */}
      <Head>
        <html lang={t('seo.ogLocale').slice(0, 2)} />
        <title>{t('seo.title')}</title>
        <meta name="description" content={t('seo.description')} />
        <meta name="robots" content="index,follow" />
        <link rel="canonical" href="https://kaydo.app/" />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Kaydo" />
        <meta property="og:title" content={t('seo.ogTitle')} />
        <meta property="og:description" content={t('seo.ogDescription')} />
        <meta property="og:url" content="https://kaydo.app/" />
        <meta property="og:image" content="https://kaydo.app/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={t('seo.ogImageAlt')} />
        <meta property="og:locale" content={t('seo.ogLocale')} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={t('seo.twitterTitle')} />
        <meta name="twitter:description" content={t('seo.twitterDescription')} />
        <meta name="twitter:image" content="https://kaydo.app/og-image.png" />
        <meta name="twitter:image:alt" content={t('seo.twitterImageAlt')} />

        {/* Structured data */}
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'Kaydo',
            description: t('seo.ldDescription'),
            url: 'https://kaydo.app',
            applicationCategory: 'LifestyleApplication',
            operatingSystem: 'Web',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            featureList: t('seo.ldFeatures', { returnObjects: true }),
            publisher: { '@type': 'Organization', name: 'Kaydo', url: 'https://kaydo.app' },
          })}
        </script>
      </Head>

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-cream border-b border-cream-dark">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 text-bark font-bold text-lg">
            <KaydoLogo size={22} />
            <span>Kaydo</span>
          </div>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-bark-light">
            <a href="#features" className="hover:text-bark transition-colors underline-offset-4 hover:underline">{t('nav.features')}</a>
            <a href="#privacy" className="hover:text-bark transition-colors">{t('nav.privacy')}</a>
            <a href="#security" className="hover:text-bark transition-colors">{t('nav.security')}</a>
          </div>

          {/* CTA + mobile menu */}
          <div className="flex items-center gap-3">
            <div className="hidden md:inline-flex">
              <LanguageSwitcher variant="sidebar" />
            </div>
            <button
              onClick={() => navigate(isAuthenticated ? '/home' : '/login?admin=1')}
              className="btn-kaydo text-sm px-5 py-2"
            >
              {t('nav.login')}
            </button>
            <button
              className="md:hidden text-bark-light hover:text-bark"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? t('common:actions.closeMenu') : t('common:actions.openMenu')}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-cream border-t border-cream-dark px-5 py-4 flex flex-col gap-4 text-sm font-medium text-bark-light">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="hover:text-bark">{t('nav.features')}</a>
            <a href="#privacy" onClick={() => setMobileMenuOpen(false)} className="hover:text-bark">{t('nav.privacy')}</a>
            <a href="#security" onClick={() => setMobileMenuOpen(false)} className="hover:text-bark">{t('nav.security')}</a>
            <div className="pt-1">
              <LanguageSwitcher variant="sidebar" />
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-5 pt-16 pb-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left — claim your family name */}
        <div>
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 text-xs font-semibold px-4 py-1.5 rounded-full mb-6 tracking-wide uppercase">
            {t('hero.badge')}
          </div>
          <h1 className="text-5xl lg:text-6xl font-bold text-bark leading-tight mb-5">
            {t('hero.titlePrefix')}{' '}
            <em className="not-italic font-serif text-kaydo italic">{t('hero.titleEmphasis')}</em>{' '}
            {t('hero.titleSuffix')}
          </h1>
          <p className="text-bark-light text-lg leading-relaxed mb-8 max-w-md">
            {t('hero.subtitlePrefix')}{' '}
            <span className="font-semibold text-bark">{t('hero.subtitleExample')}</span>{' '}
            {t('hero.subtitleSuffix')}
          </p>

          <ClaimFamilyName
            navigate={navigate}
            isAuthenticated={isAuthenticated}
            signup={signup}
            firebaseReady={firebaseReady}
          />
        </div>

        {/* Right — real app screenshot */}
        <div className="relative flex items-center justify-center">
          <BrowserFrame
            src="/screenshots/home-desktop.webp"
            alt={t('screens.homeAlt')}
            width={1200}
            height={750}
            className="w-full max-w-xl lg:rotate-1"
          />
        </div>
      </section>

      {/* ── Six Pillars ── */}
      <section id="features" className="bg-warm-white py-20">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-bark mb-3">{t('pillars.sectionTitle')}</h2>
            <p className="text-bark-light max-w-md mx-auto">
              {t('pillars.sectionSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Card 1 — Share: Moments & Memories (full-width) */}
            <div className="md:col-span-2 bg-gradient-to-br from-amber-50 to-cream-dark rounded-3xl p-8 flex flex-col lg:flex-row gap-8 items-start">
              {/* Left — text */}
              <div className="flex-1">
                <div className="w-10 h-10 bg-kaydo/10 rounded-xl flex items-center justify-center mb-5">
                  <Camera className="w-5 h-5 text-kaydo" />
                </div>
                <h3 className="text-xl font-bold text-bark mb-2">{t('pillars.share.title')}</h3>
                <p className="text-bark-light text-sm leading-relaxed mb-6 max-w-lg">
                  {t('pillars.share.desc')}
                </p>
                <ul className="space-y-2">
                  {t('pillars.share.bullets', { returnObjects: true }).map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-bark">
                      <Check className="w-4 h-4 text-kaydo mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right — media type badges + real mobile screenshot */}
              <div className="flex flex-col gap-5 lg:w-64 w-full">
                {/* Media type pills */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { icon: <Camera className="w-4 h-4" />, label: t('pillars.share.pills.photos') },
                    { icon: <Video className="w-4 h-4" />, label: t('pillars.share.pills.videos') },
                    { icon: <Mic className="w-4 h-4" />, label: t('pillars.share.pills.voiceMemos') },
                  ].map(({ icon, label }) => (
                    <div key={label} className="flex items-center gap-2 bg-white rounded-full px-4 py-2 text-sm font-medium text-bark shadow-sm border border-cream-dark">
                      <span className="text-kaydo">{icon}</span>
                      {label}
                    </div>
                  ))}
                </div>

                {/* Real mobile app screenshot */}
                <PhoneFrame
                  src="/screenshots/home-mobile.webp"
                  alt={t('screens.homeMobileAlt')}
                  width={440}
                  height={952}
                />
              </div>
            </div>

            {/* Card 2 — Preserve: The Vault */}
            <div className="bg-cream-dark rounded-3xl p-8 flex flex-col gap-5">
              <div className="w-10 h-10 bg-kaydo/10 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-kaydo" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-bark mb-2">{t('pillars.vault.title')}</h3>
                <p className="text-bark-light text-sm leading-relaxed">
                  {t('pillars.vault.desc')}
                </p>
              </div>
              <ul className="space-y-2">
                {t('pillars.vault.bullets', { returnObjects: true }).map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-bark font-medium">
                    <Check className="w-4 h-4 text-kaydo" />
                    {item}
                  </li>
                ))}
              </ul>
              {/* Real Black Box vault screenshot */}
              <BrowserFrame
                src="/screenshots/blackbox-desktop.webp"
                alt={t('screens.blackboxAlt')}
                width={1200}
                height={750}
                className="mt-2"
              />
            </div>

            {/* Card 2 — Write: The Letters */}
            <div className="bg-kaydo rounded-3xl p-8 flex flex-col gap-5">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">{t('pillars.letters.title')}</h3>
                <p className="text-white/80 text-sm leading-relaxed">
                  {t('pillars.letters.desc')}
                </p>
              </div>
              <div className="mt-auto">
                <button
                  onClick={() => navigate(isAuthenticated ? '/home' : '/login?admin=1')}
                  className="px-5 py-2.5 rounded-full border-2 border-white/60 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
                >
                  {t('pillars.letters.button')}
                </button>
              </div>
              {/* Real journal / letters screenshot */}
              <BrowserFrame
                src="/screenshots/journal-desktop.webp"
                alt={t('screens.journalAlt')}
                width={1200}
                height={750}
                className="mt-2"
              />
            </div>

            {/* Card 3 — Evolve: Recipe Tree */}
            <div className="bg-[#E8F5E0] rounded-3xl p-8 flex flex-col gap-5">
              <div className="w-10 h-10 bg-green-600/10 rounded-xl flex items-center justify-center">
                <Utensils className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-bark mb-2">{t('pillars.recipe.title')}</h3>
                <p className="text-bark-light text-sm leading-relaxed">
                  {t('pillars.recipe.desc')}
                </p>
              </div>
              {/* Real recipe evolution tree screenshot */}
              <BrowserFrame
                src="/screenshots/recipe-tree-desktop.webp"
                alt={t('screens.recipeAlt')}
                width={1200}
                height={750}
                className="mt-auto"
              />
            </div>

            {/* Card 5 — Create: Digital Scrapbook (full-width) */}
            <div className="md:col-span-2 bg-[#EDE9F5] rounded-3xl p-8 flex flex-col lg:flex-row gap-8 items-start">
              {/* Left — text */}
              <div className="flex-1">
                <div className="w-10 h-10 bg-violet-600/10 rounded-xl flex items-center justify-center mb-5">
                  <Scissors className="w-5 h-5 text-violet-700" />
                </div>
                <h3 className="text-xl font-bold text-bark mb-2">{t('pillars.scrapbook.title')}</h3>
                <p className="text-bark-light text-sm leading-relaxed mb-6 max-w-lg">
                  {t('pillars.scrapbook.desc')}
                </p>
                <ul className="space-y-2">
                  {[
                    { icon: <Layers className="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0" />, text: t('pillars.scrapbook.bullets', { returnObjects: true })[0] },
                    { icon: <Check className="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0" />, text: t('pillars.scrapbook.bullets', { returnObjects: true })[1] },
                    { icon: <Check className="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0" />, text: t('pillars.scrapbook.bullets', { returnObjects: true })[2] },
                  ].map(({ icon, text }) => (
                    <li key={text} className="flex items-start gap-2 text-sm text-bark">
                      {icon}
                      {text}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate(isAuthenticated ? '/home' : '/login?admin=1')}
                  className="mt-6 px-5 py-2.5 rounded-full border-2 border-violet-400/60 text-violet-800 text-sm font-semibold hover:bg-violet-100 transition-colors"
                >
                  {t('pillars.scrapbook.button')}
                </button>
              </div>

              {/* Right — real scrapbook editor screenshot */}
              <div className="lg:w-96 w-full flex-shrink-0">
                <BrowserFrame
                  src="/screenshots/scrapbook-desktop.webp"
                  alt={t('screens.scrapbookAlt')}
                  width={1200}
                  height={750}
                />
              </div>
            </div>

            {/* Card 6 — Own: Data Export */}
            <div className="bg-[#E0F4F8] rounded-3xl p-8 flex flex-col gap-5">
              <div className="w-10 h-10 bg-teal-600/10 rounded-xl flex items-center justify-center">
                <Download className="w-5 h-5 text-teal-700" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-bark mb-2">{t('pillars.export.title')}</h3>
                <p className="text-bark-light text-sm leading-relaxed">
                  {t('pillars.export.desc')}
                </p>
              </div>
              <ul className="space-y-2">
                {t('pillars.export.bullets', { returnObjects: true }).map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-bark font-medium">
                    <Check className="w-4 h-4 text-teal-600" />
                    {item}
                  </li>
                ))}
              </ul>
              {/* Decorative download mockup */}
              <div className="mt-2 rounded-2xl bg-white/60 border border-teal-100 p-4 space-y-2.5">
                {[
                  { name: 'family_photos.zip', size: '2.4 GB', progress: 100 },
                  { name: 'memories_export.json', size: '18 KB', progress: 100 },
                  { name: 'scrapbooks.pdf', size: '340 MB', progress: 72 },
                ].map(({ name, size, progress }) => (
                  <div key={name} className="flex items-center gap-3">
                    <div className="w-6 h-6 flex-shrink-0 bg-teal-100 rounded-md flex items-center justify-center">
                      <Download className="w-3 h-3 text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-medium text-bark truncate">{name}</span>
                        <span className="text-[10px] text-bark-muted ml-2 flex-shrink-0">{size}</span>
                      </div>
                      <div className="h-1 bg-teal-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-500 rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 7 — Open Source */}
            <div className="bg-bark rounded-3xl p-8 flex flex-col gap-5">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <OctocatIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">{t('pillars.openSource.title')}</h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  {t('pillars.openSource.desc')}
                </p>
              </div>
              {/* Stats row */}
              <div className="flex gap-4 mt-auto">
                <div className="flex items-center gap-1.5 text-white/60 text-xs font-medium">
                  <Star className="w-3.5 h-3.5" />
                  <span>{t('pillars.openSource.star')}</span>
                </div>
                <div className="flex items-center gap-1.5 text-white/60 text-xs font-medium">
                  <GitFork className="w-3.5 h-3.5" />
                  <span>{t('pillars.openSource.fork')}</span>
                </div>
              </div>
              <a
                href="https://github.com/Gnadi/0815memories"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition-colors w-fit"
              >
                <OctocatIcon className="w-4 h-4" />
                {t('pillars.openSource.viewOnGithub')}
              </a>
            </div>

          </div>
        </div>
      </section>

      {/* ── Privacy Manifesto ── */}
      <section id="privacy" className="py-20">
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <div>
              <div className="inline-flex items-center gap-2 bg-bark text-cream text-xs font-semibold px-4 py-1.5 rounded-full mb-6 tracking-wide uppercase">
                {t('privacy.badge')}
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold text-bark leading-tight mb-6">
                {t('privacy.titlePrefix')}{' '}
                <em className="italic underline decoration-kaydo decoration-2">{t('privacy.titleEmphasis')}</em>
                {t('privacy.titleSuffix')}
              </h2>
              <ul className="space-y-6">
                {[
                  { icon: <Ban className="w-5 h-5 text-red-500" />, ...t('privacy.items', { returnObjects: true })[0] },
                  { icon: <Shield className="w-5 h-5 text-kaydo" />, ...t('privacy.items', { returnObjects: true })[1] },
                  { icon: <X className="w-5 h-5 text-bark-light" />, ...t('privacy.items', { returnObjects: true })[2] },
                ].map(({ icon, title, desc }) => (
                  <li key={title} className="flex gap-4">
                    <div className="flex-shrink-0 w-9 h-9 bg-cream-dark rounded-xl flex items-center justify-center mt-0.5">
                      {icon}
                    </div>
                    <div>
                      <p className="font-semibold text-bark mb-1">{title}</p>
                      <p className="text-bark-light text-sm leading-relaxed">{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — stats grid */}
            <div id="security" className="grid grid-cols-2 gap-4">
              {[
                { value: '100%', label: t('privacy.stats.ownership'), color: 'text-kaydo' },
                { icon: <Lock className="w-8 h-8 text-amber-600" />, label: t('privacy.stats.encryption'), color: '' },
                { icon: <Check className="w-8 h-8 text-green-600" />, label: t('privacy.stats.verified'), color: '' },
                { value: '0', label: t('privacy.stats.breaches'), color: 'text-bark' },
              ].map(({ value, icon, label, color }, i) => (
                <div key={i} className="bg-warm-white rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-center shadow-sm">
                  {value !== undefined ? (
                    <span className={`text-3xl font-bold ${color}`}>{value}</span>
                  ) : (
                    icon
                  )}
                  <span className="text-xs font-bold text-bark-muted tracking-widest uppercase">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-warm-white py-24">
        <div className="max-w-2xl mx-auto px-5 text-center">
          <h2 className="text-3xl lg:text-5xl font-bold text-bark mb-4">
            {t('cta.title')}
          </h2>
          <p className="text-bark-light text-lg mb-10">
            {t('cta.subtitle')}
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-4">
            <button
              onClick={() => navigate(isAuthenticated ? '/home' : '/signup')}
              className="btn-kaydo text-base px-8 py-3"
            >
              {t('cta.getStarted')}
            </button>
            <a
              href="https://github.com/Gnadi/0815memories"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-8 py-3 rounded-full border-2 border-bark-muted text-bark font-semibold hover:border-bark transition-colors text-base"
            >
              <OctocatIcon className="w-5 h-5" />
              {t('cta.openSource')}
            </a>
          </div>
          <p className="text-xs text-bark-muted">{t('cta.noCreditCard')}</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-cream border-t border-cream-dark py-8">
        <div className="max-w-6xl mx-auto px-5 flex flex-col items-center gap-5">
          {/* Logo */}
          <div className="flex items-center gap-2 text-bark font-bold">
            <KaydoLogo size={18} />
            <span>Kaydo</span>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap justify-center gap-6 text-xs font-semibold text-bark-muted tracking-wider uppercase">
            {t('footer.links', { returnObjects: true }).map((link) => (
              <Link key={link.to} to={link.to} className="hover:text-bark transition-colors">
                {link.label}
              </Link>
            ))}
            {canInstall && (
              <button type="button" onClick={promptInstall} className="hover:text-bark transition-colors">
                {t('footer.install')}
              </button>
            )}
          </nav>

          {/* Safety guidelines */}
          <Link to={t('footer.safetyTo')} className="text-xs text-bark-muted hover:text-bark transition-colors tracking-wider uppercase">
            {t('footer.safety')}
          </Link>

          {/* Copyright */}
          <p className="text-xs text-bark-muted text-center">
            {t('footer.copyright', { year: new Date().getFullYear() })}{' '}
            <span className="text-bark-muted">{t('footer.crafted')}</span>
          </p>
        </div>
      </footer>
    </div>
  )
}

/**
 * Domain-registrar-style widget: type a family name, check whether
 * `<slug>.kaydo.app` is available, and — if it is — create the account inline
 * without leaving the landing page.
 */
function ClaimFamilyName({ navigate, isAuthenticated, signup, firebaseReady }) {
  const { t } = useTranslation('landing')
  const [familyName, setFamilyName] = useState('')
  // 'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  const [status, setStatus] = useState('idle')

  // Inline claim form
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const slug = useMemo(() => generateSlug(familyName), [familyName])
  const domain = slug ? `${slug}.kaydo.app` : ''

  // Reset the result whenever the name changes — the previous answer is stale.
  const handleNameChange = (value) => {
    setFamilyName(value)
    setStatus('idle')
    setError('')
  }

  const handleCheck = async (e) => {
    e.preventDefault()
    if (!slug) {
      setStatus('invalid')
      return
    }
    setStatus('checking')
    try {
      const available = await isSlugAvailable(slug)
      setStatus(available ? 'available' : 'taken')
    } catch {
      setStatus('idle')
      setError(t('claim.errors.couldNotCheck'))
    }
  }

  const handleClaim = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError(t('claim.errors.passwordTooShort'))
      return
    }

    setSubmitting(true)
    try {
      await signup(email, password, displayName, familyName)
      navigate('/home')
    } catch (err) {
      const messages = {
        'auth/email-already-in-use': t('claim.errors.emailInUse'),
        'auth/invalid-email': t('claim.errors.invalidEmail'),
        'auth/weak-password': t('claim.errors.weakPassword'),
      }
      // If the slug was claimed between the check and now, signup throws too.
      setError(messages[err.code] || t('claim.errors.generic'))
      if (/already taken/i.test(err.message || '')) setStatus('taken')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-md">
      {/* ── Availability checker ── */}
      <form onSubmit={handleCheck}>
        <div className="flex items-stretch bg-white rounded-2xl shadow-lg border border-cream-dark overflow-hidden focus-within:ring-2 focus-within:ring-kaydo/30">
          <input
            type="text"
            value={familyName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={t('claim.namePlaceholder')}
            aria-label={t('claim.nameAriaLabel')}
            className="flex-1 min-w-0 pl-4 py-3.5 bg-transparent border-none outline-none text-bark placeholder-bark-muted text-base"
          />
          <span className="flex items-center pr-3 text-bark-muted font-medium select-none">
            .kaydo.app
          </span>
          <button
            type="submit"
            disabled={status === 'checking'}
            className="btn-kaydo rounded-none px-5 flex items-center gap-2 text-sm disabled:opacity-60"
          >
            {status === 'checking' ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Search className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">{t('claim.check')}</span>
              </>
            )}
          </button>
        </div>

        {/* Live preview of the resulting address */}
        {slug && status === 'idle' && (
          <p className="text-xs text-bark-muted mt-2 pl-1">
            {t('claim.previewLabel')}{' '}
            <span className="font-medium text-kaydo">{domain}</span>
          </p>
        )}
      </form>

      {/* ── Result states ── */}
      {status === 'invalid' && (
        <p className="text-sm text-amber-700 bg-amber-50 px-4 py-2.5 rounded-xl mt-3">
          {t('claim.invalid')}
        </p>
      )}

      {status === 'taken' && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-xl mt-3 flex items-center gap-2">
          <Ban className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">{domain}</span> {t('claim.takenSuffix')}
          </span>
        </p>
      )}

      {status === 'available' && (
        <div className="mt-3">
          <p className="text-sm text-green-700 bg-green-50 px-4 py-2.5 rounded-xl flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-semibold">{domain}</span> {t('claim.availableSuffix')}
            </span>
          </p>

          {/* Inline claim / signup form */}
          {!firebaseReady && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm mt-4">
              <strong>{t('claim.setupRequiredTitle')}</strong> {t('claim.setupRequiredBody')}
            </div>
          )}

          <form onSubmit={handleClaim} className="space-y-3 mt-4">
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" aria-hidden="true" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('claim.displayNamePlaceholder')}
                aria-label={t('claim.displayNameAriaLabel')}
                className="w-full pl-12 pr-4 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-kaydo/30"
                required
              />
            </div>

            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" aria-hidden="true" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('claim.emailPlaceholder')}
                aria-label={t('claim.emailAriaLabel')}
                className="w-full pl-12 pr-4 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-kaydo/30"
                required
              />
            </div>

            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" aria-hidden="true" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('claim.passwordPlaceholder')}
                aria-label={t('claim.passwordAriaLabel')}
                className="w-full pl-12 pr-12 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-kaydo/30"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-bark-muted hover:text-bark"
                aria-label={showPassword ? t('claim.hidePassword') : t('claim.showPassword')}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !firebaseReady}
              className="btn-kaydo w-full flex items-center justify-center gap-2 text-base disabled:opacity-60"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {t('claim.submit', { domain })}
                  <span className="text-xl">&rarr;</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Generic check error (separate from claim-form error) */}
      {error && status !== 'available' && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-xl mt-3">
          {error}
        </p>
      )}

      {/* Secondary path for returning users */}
      <p className="text-sm text-bark-light mt-5 pl-1">
        {t('claim.alreadyHaveAccount')}{' '}
        <button
          onClick={() => navigate(isAuthenticated ? '/home' : '/login?admin=1')}
          className="text-kaydo font-semibold hover:text-kaydo-dark"
        >
          {t('claim.login')}
        </button>
      </p>
    </div>
  )
}

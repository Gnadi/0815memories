import { Link } from 'react-router-dom'
import { Head } from 'vite-react-ssg'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import KaydoLogo from '../components/KaydoLogo'
import LanguageSwitcher from '../components/LanguageSwitcher'

// Renders a single legal / informational document. All copy lives in the
// `legal` i18n namespace, keyed by `docKey` (e.g. "terms", "privacy-policy",
// "imprint", "contact", "safety"), so each route is just <LegalPage docKey="…" />.
export default function LegalPage({ docKey }) {
  const { t } = useTranslation('legal')

  const doc = t(docKey, { returnObjects: true }) || {}
  const sections = Array.isArray(doc.sections) ? doc.sections : []

  return (
    <div className="min-h-screen bg-cream font-sans flex flex-col">
      <Head>
        <title>{doc.seoTitle}</title>
        <meta name="description" content={doc.seoDescription} />
        <meta name="robots" content="index,follow" />
      </Head>

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-50 bg-cream border-b border-cream-dark">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-bark font-bold text-lg">
            <KaydoLogo size={22} />
            <span>Kaydo</span>
          </Link>
          <LanguageSwitcher variant="sidebar" />
        </div>
      </header>

      {/* ── Document ── */}
      <main className="flex-1">
        <article className="max-w-3xl mx-auto px-5 py-12">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-bark-muted hover:text-bark transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('nav.backHome')}
          </Link>

          <h1 className="text-3xl md:text-4xl font-bold text-bark mb-3">{doc.title}</h1>

          {(doc.effective || doc.lastUpdated) && (
            <p className="text-sm text-bark-muted mb-6">{doc.effective || doc.lastUpdated}</p>
          )}

          {doc.intro && (
            <p className="text-base text-bark-light leading-relaxed mb-8">{doc.intro}</p>
          )}

          {/* Optional notice box (used by the Imprint for fill-in fields) */}
          {doc.note && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 mb-10">
              {doc.noteTitle && (
                <p className="text-sm font-semibold text-amber-800 mb-1">{doc.noteTitle}</p>
              )}
              <p className="text-sm text-amber-800 leading-relaxed">{doc.note}</p>
            </div>
          )}

          <div className="space-y-8">
            {sections.map((section, i) => (
              <section key={i}>
                {section.heading && (
                  <h2 className="text-xl font-bold text-bark mb-3">{section.heading}</h2>
                )}
                <div className="space-y-3">
                  {(section.paragraphs || []).map((paragraph, j) => (
                    <p key={j} className="text-base text-bark-light leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <p className="text-xs text-bark-muted leading-relaxed mt-12 pt-6 border-t border-cream-dark">
            {t('meta.disclaimer')}
          </p>
        </article>
      </main>

      {/* ── Minimal footer ── */}
      <footer className="bg-cream border-t border-cream-dark py-6">
        <div className="max-w-3xl mx-auto px-5 flex items-center justify-center gap-2 text-xs text-bark-muted">
          <KaydoLogo size={14} />
          <span>© {new Date().getFullYear()} Kaydo</span>
        </div>
      </footer>
    </div>
  )
}

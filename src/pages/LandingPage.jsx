import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-cream text-bark">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-warm-white/95 backdrop-blur border-b border-cream-dark">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <span className="font-serif text-xl font-bold text-bark">FamilyHearth</span>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-bark-light hover:text-hearth transition-colors border-b-2 border-hearth pb-0.5">Features</a>
            <a href="#privacy" className="text-sm font-medium text-bark-light hover:text-hearth transition-colors">Privacy</a>
            <a href="#security" className="text-sm font-medium text-bark-light hover:text-hearth transition-colors">Security</a>
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:block">
            <Link to="/login" className="btn-hearth text-sm px-5 py-2.5">
              Request an Invite
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-bark-light hover:text-bark transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-warm-white border-t border-cream-dark px-4 py-4 flex flex-col gap-4">
            <a href="#features" className="text-sm font-medium text-bark-light" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#privacy" className="text-sm font-medium text-bark-light" onClick={() => setMobileMenuOpen(false)}>Privacy</a>
            <a href="#security" className="text-sm font-medium text-bark-light" onClick={() => setMobileMenuOpen(false)}>Security</a>
            <Link to="/login" className="btn-hearth text-sm text-center px-5 py-2.5" onClick={() => setMobileMenuOpen(false)}>
              Request an Invite
            </Link>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24 flex flex-col md:flex-row items-center gap-12">
        {/* Left */}
        <div className="flex-1 text-center md:text-left">
          <span className="inline-block bg-hearth/10 text-hearth text-xs font-semibold tracking-widest uppercase px-3 py-1.5 rounded-full mb-6">
            Your Private Digital Hearth
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-bark leading-tight mb-6">
            Preserving the{' '}
            <em className="text-hearth not-italic">Soul</em>{' '}
            of Family.
          </h1>
          <p className="text-bark-light text-lg leading-relaxed mb-8 max-w-md mx-auto md:mx-0">
            A curated sanctuary for your family's narratives. No algorithms, no ads, no AI training. Just pure, unadulterated memories.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
            <Link to="/login" className="btn-hearth text-center px-8 py-3">
              Get Started
            </Link>
            <a
              href="#features"
              className="px-8 py-3 rounded-full border-2 border-bark/20 text-bark font-semibold hover:border-hearth hover:text-hearth transition-all text-center"
            >
              View the Demo
            </a>
          </div>
        </div>

        {/* Right – decorative image card */}
        <div className="flex-1 flex justify-center md:justify-end">
          <div className="relative w-full max-w-sm">
            {/* Main image placeholder */}
            <div className="rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-br from-amber-800 via-amber-700 to-amber-900 aspect-[4/3]">
              <div className="w-full h-full flex items-end p-6 bg-gradient-to-t from-black/50 to-transparent">
                <div className="text-white">
                  <p className="text-sm opacity-75">Gathered together</p>
                  <p className="font-semibold">The Miller Family, 2024</p>
                </div>
              </div>
            </div>
            {/* Floating journal card */}
            <div className="absolute -bottom-6 -left-6 bg-warm-white rounded-2xl shadow-xl p-3 w-44">
              <div className="bg-cream-dark rounded-xl h-20 mb-2 flex items-center justify-center">
                <svg className="w-8 h-8 text-hearth" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-bark">Family Journal</p>
              <p className="text-xs text-bark-muted">12 new entries</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Four Pillars ── */}
      <section id="features" className="py-20 bg-warm-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-bark mb-4">Four Pillars of the Hearth</h2>
            <p className="text-bark-light max-w-lg mx-auto">
              Thoughtfully engineered spaces designed to nurture legacy and foster deep connections across generations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1 – Vault */}
            <div className="bg-cream rounded-3xl p-8 flex flex-col gap-6 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-hearth/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-hearth" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="font-serif text-2xl font-bold text-bark mb-3">Preserve: The Vault</h3>
                <p className="text-bark-light leading-relaxed mb-5">
                  Securely store high-fidelity originals of your most precious assets. From deed documents to rare family photos, our Black Box encryption ensures they remain yours alone.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm font-medium text-bark">
                    <span className="w-4 h-4 rounded-full bg-hearth/15 flex items-center justify-center flex-shrink-0">
                      <svg className="w-2.5 h-2.5 text-hearth" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3"/></svg>
                    </span>
                    Military-grade encryption
                  </li>
                  <li className="flex items-center gap-2 text-sm font-medium text-bark">
                    <span className="w-4 h-4 rounded-full bg-hearth/15 flex items-center justify-center flex-shrink-0">
                      <svg className="w-2.5 h-2.5 text-hearth" fill="currentColor" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3"/></svg>
                    </span>
                    Zero-knowledge storage
                  </li>
                </ul>
              </div>
              {/* Visual */}
              <div className="rounded-2xl bg-gradient-to-br from-amber-900 via-yellow-900 to-amber-800 h-36 flex items-center justify-center overflow-hidden">
                <svg className="w-16 h-16 text-amber-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>

            {/* Card 2 – Letters */}
            <div className="bg-hearth rounded-3xl p-8 flex flex-col gap-6 shadow-sm text-white">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-serif text-2xl font-bold mb-3">Write: The Letters</h3>
                <p className="text-white/80 leading-relaxed mb-8">
                  Schedule messages for the future. Congratulate a grandchild on a wedding you might not attend, or share wisdom across decades.
                </p>
              </div>
              <div>
                <Link
                  to="/login"
                  className="inline-block bg-white/20 hover:bg-white/30 transition-colors text-white text-sm font-semibold px-5 py-2.5 rounded-full"
                >
                  Compose a Legacy
                </Link>
              </div>
              {/* Decorative plane icon */}
              <div className="flex justify-end opacity-20">
                <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M21.71 3.29a1 1 0 00-1.42 0l-18 18a1 1 0 000 1.42A1 1 0 003 23a1 1 0 00.71-.29l18-18a1 1 0 000-1.42z"/>
                  <path d="M12.71 6.29l-4-4a1 1 0 00-1.09-.22A1 1 0 007 3v5.59L2.71 12.88a1 1 0 000 1.41l1 1a1 1 0 001.09.22L9 13.41V19a1 1 0 00.62.92A1 1 0 0010 20a1 1 0 00.71-.29l2-2a1 1 0 00.29-.71v-3.17l5.34 2.29a1 1 0 001.35-1.35z"/>
                </svg>
              </div>
            </div>

            {/* Card 3 – Recipe Tree */}
            <div className="bg-lime-100 rounded-3xl p-8 flex flex-col gap-6 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-green-200 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-serif text-2xl font-bold text-bark mb-3">Evolve: Recipe Tree</h3>
                <p className="text-bark-light leading-relaxed mb-5">
                  Recipes aren't static. Watch how Grandma's pasta evolved through three generations, with notes, variations, and photo logs of every holiday meal.
                </p>
              </div>
              {/* Avatar stack */}
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {['bg-amber-400', 'bg-rose-400', 'bg-sky-400'].map((color, i) => (
                    <div key={i} className={`w-8 h-8 rounded-full ${color} border-2 border-lime-100 flex items-center justify-center text-white text-xs font-bold`}>
                      {['G', 'M', 'J'][i]}
                    </div>
                  ))}
                  <div className="w-8 h-8 rounded-full bg-bark-muted border-2 border-lime-100 flex items-center justify-center text-white text-xs font-bold">
                    +12
                  </div>
                </div>
                <span className="text-sm text-bark-light">family contributors</span>
              </div>
            </div>

            {/* Card 4 – Scrapbook */}
            <div className="bg-cream-dark rounded-3xl p-8 flex flex-col gap-6 shadow-sm">
              <div>
                <h3 className="font-serif text-2xl font-bold text-bark mb-3">Create: Scrapbook</h3>
                <p className="text-bark-light leading-relaxed">
                  The anti-feed. A non-linear, tactile digital canvas where you drag, drop, and layer your family's favorite moments into stunning interactive spreads.
                </p>
              </div>
              {/* Photo collage grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-gradient-to-br from-orange-400 to-pink-500 aspect-[4/3]" />
                <div className="rounded-2xl bg-gradient-to-br from-yellow-400 to-green-500 aspect-[4/3]" />
                <div className="col-span-2 rounded-2xl bg-hearth/10 py-3 px-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-hearth" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-semibold text-hearth">July '24 Roadtrip</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Privacy Manifesto ── */}
      <section id="privacy" className="py-20 bg-cream-dark">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row gap-12 items-start">
            {/* Left */}
            <div className="flex-1">
              <span className="inline-block bg-bark/10 text-bark text-xs font-semibold tracking-widest uppercase px-3 py-1.5 rounded-full mb-6">
                Our Privacy Manifesto
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-bark leading-tight mb-8">
                Your data is a{' '}
                <span className="italic underline decoration-hearth">sacred legacy</span>
                , not a training set.
              </h2>

              <div className="space-y-6">
                {[
                  {
                    title: 'No AI Training',
                    desc: "We strictly prohibit the use of your private photos or text for LLM or AI generative model training. Ever.",
                  },
                  {
                    title: 'Zero-Knowledge Architecture',
                    desc: "Your 'Black Box' content is encrypted locally. Even our engineers can't see your family photos.",
                  },
                  {
                    title: 'Ad-Free Forever',
                    desc: "We are funded by families, for families. We will never sell your attention to advertisers.",
                  },
                ].map(({ title, desc }) => (
                  <div key={title} className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-hearth/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-hearth" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-bark mb-1">{title}</p>
                      <p className="text-bark-light text-sm leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right – stat tiles */}
            <div className="flex-1 grid grid-cols-2 gap-4">
              {[
                { value: '100%', label: 'Private Ownership', icon: (
                  <svg className="w-6 h-6 text-hearth" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )},
                { value: 'E2E', label: 'Encryption', icon: (
                  <svg className="w-6 h-6 text-bark-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                )},
                { value: '✓', label: 'Verified Members Only', icon: null, checkmark: true },
                { value: '0', label: 'Data Breaches', icon: null },
              ].map(({ value, label, icon, checkmark }) => (
                <div key={label} className="bg-warm-white rounded-2xl p-6 shadow-sm flex flex-col gap-3">
                  {icon && <div>{icon}</div>}
                  {checkmark && (
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  <div>
                    <p className="font-serif text-3xl font-bold text-hearth">{checkmark ? '' : value}</p>
                    <p className="text-xs font-semibold text-bark-light uppercase tracking-wider mt-1">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section id="security" className="py-24 bg-cream">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-bark mb-6">
            Ready to bring your family home?
          </h2>
          <p className="text-bark-light text-lg mb-10 leading-relaxed">
            Join the exclusive circle of families preserving their stories with dignity and style. Invite-only access ensures the highest standards of safety.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-4">
            <Link to="/login" className="btn-hearth text-center px-8 py-3.5">
              Request My Invite
            </Link>
            <a
              href="#features"
              className="px-8 py-3.5 rounded-full border-2 border-bark/20 text-bark font-semibold hover:border-hearth hover:text-hearth transition-all text-center"
            >
              Learn about Pricing
            </a>
          </div>
          <p className="text-bark-muted text-sm">No credit card required to join the waitlist.</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-warm-white border-t border-cream-dark py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <span className="font-serif text-lg font-bold text-bark">FamilyHearth</span>
            <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
              {['Terms of Service', 'Privacy Policy', 'Help Center', 'Contact Us', 'Safety Guidelines'].map((link) => (
                <a key={link} href="#" className="text-xs text-bark-muted hover:text-hearth transition-colors uppercase tracking-wide">
                  {link}
                </a>
              ))}
            </nav>
          </div>
          <p className="text-center text-xs text-bark-muted mt-8">
            © 2024 FamilyHearth. All rights reserved. Crafted for memories.
          </p>
        </div>
      </footer>
    </div>
  )
}

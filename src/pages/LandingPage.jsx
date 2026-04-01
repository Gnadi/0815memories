import { useNavigate } from 'react-router-dom'
import {
  Home,
  Shield,
  Mail,
  Utensils,
  BookOpen,
  Lock,
  Check,
  Ban,
  X,
  Menu,
} from 'lucide-react'
import { useState } from 'react'

export default function LandingPage() {
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-cream font-sans">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-cream border-b border-cream-dark">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 text-bark font-bold text-lg">
            <Home className="w-5 h-5 text-hearth" />
            <span>FamilyHearth</span>
          </div>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-bark-light">
            <a href="#features" className="hover:text-bark transition-colors underline-offset-4 hover:underline">Features</a>
            <a href="#privacy" className="hover:text-bark transition-colors">Privacy</a>
            <a href="#security" className="hover:text-bark transition-colors">Security</a>
          </div>

          {/* CTA + mobile menu */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/signup')}
              className="btn-hearth text-sm px-5 py-2"
            >
              Request an Invite
            </button>
            <button
              className="md:hidden text-bark-light hover:text-bark"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-cream border-t border-cream-dark px-5 py-4 flex flex-col gap-4 text-sm font-medium text-bark-light">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="hover:text-bark">Features</a>
            <a href="#privacy" onClick={() => setMobileMenuOpen(false)} className="hover:text-bark">Privacy</a>
            <a href="#security" onClick={() => setMobileMenuOpen(false)} className="hover:text-bark">Security</a>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-5 pt-16 pb-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left */}
        <div>
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 text-xs font-semibold px-4 py-1.5 rounded-full mb-6 tracking-wide uppercase">
            Your Private Digital Hearth
          </div>
          <h1 className="text-5xl lg:text-6xl font-bold text-bark leading-tight mb-5">
            Preserving the{' '}
            <em className="not-italic font-serif text-hearth italic">Soul</em>{' '}
            of Family.
          </h1>
          <p className="text-bark-light text-lg leading-relaxed mb-8 max-w-md">
            A curated sanctuary for your family's narratives. No algorithms, no ads, no AI training. Just pure, unadulterated memories.
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => navigate('/login')}
              className="btn-hearth text-base px-8 py-3"
            >
              Get Started
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-3 rounded-full border-2 border-bark-muted text-bark font-semibold hover:border-bark transition-colors text-base"
            >
              View the Demo
            </button>
          </div>
        </div>

        {/* Right — decorative journal card */}
        <div className="relative flex items-center justify-center">
          {/* Main photo placeholder */}
          <div className="w-full max-w-sm lg:max-w-none h-72 lg:h-96 rounded-3xl bg-gradient-to-br from-amber-900 via-amber-700 to-amber-500 overflow-hidden relative shadow-2xl">
            {/* Warm light overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            {/* Simulated family silhouette */}
            <div className="absolute inset-0 flex items-center justify-center opacity-20">
              <div className="flex gap-3 items-end">
                {[64, 80, 72, 56, 48].map((h, i) => (
                  <div
                    key={i}
                    style={{ height: `${h}px`, width: '18px' }}
                    className="bg-white rounded-full"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Overlay journal card */}
          <div className="absolute -bottom-4 -left-4 lg:-left-8 bg-white rounded-2xl shadow-xl p-4 w-48">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 bg-hearth rounded-lg flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-semibold text-bark">Family Journal</span>
            </div>
            <div className="space-y-1.5">
              {['Summer vacation...', 'Grandma\'s recipe', 'First day of...'].map((line, i) => (
                <div key={i} className="h-2 rounded-full bg-cream-dark" style={{ width: `${[90, 70, 80][i]}%` }} />
              ))}
            </div>
            <div className="mt-3 flex gap-1">
              {['bg-hearth', 'bg-amber-400', 'bg-green-400'].map((c, i) => (
                <div key={i} className={`w-5 h-5 rounded-full ${c} border-2 border-white -ml-1 first:ml-0`} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Four Pillars ── */}
      <section id="features" className="bg-warm-white py-20">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-bark mb-3">Four Pillars of the Hearth</h2>
            <p className="text-bark-light max-w-md mx-auto">
              Thoughtfully engineered spaces designed to nurture legacy and foster deep connections across generations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Card 1 — Preserve: The Vault */}
            <div className="bg-cream-dark rounded-3xl p-8 flex flex-col gap-5">
              <div className="w-10 h-10 bg-hearth/10 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-hearth" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-bark mb-2">Preserve: The Vault</h3>
                <p className="text-bark-light text-sm leading-relaxed">
                  Securely store high-fidelity originals of your most precious assets. From deed documents to rare family photos, our Black Box encryption ensures they remain yours alone.
                </p>
              </div>
              <ul className="space-y-2">
                {['Military-grade encryption', 'Zero-knowledge storage'].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-bark font-medium">
                    <Check className="w-4 h-4 text-hearth" />
                    {item}
                  </li>
                ))}
              </ul>
              {/* Decorative keyhole */}
              <div className="mt-2 rounded-2xl bg-bark overflow-hidden h-32 flex items-center justify-center relative">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-900/60 to-transparent" />
                <div className="relative z-10 flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-full border-4 border-amber-400/60 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-amber-400/80" />
                  </div>
                  <div className="w-3 h-6 bg-amber-400/40 rounded-b-full mt-1" />
                </div>
              </div>
            </div>

            {/* Card 2 — Write: The Letters */}
            <div className="bg-hearth rounded-3xl p-8 flex flex-col gap-5">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Write: The Letters</h3>
                <p className="text-white/80 text-sm leading-relaxed">
                  Schedule messages for the future. Congratulate a grandchild on a wedding you might not attend, or share wisdom across decades.
                </p>
              </div>
              <div className="mt-auto">
                <button
                  onClick={() => navigate('/login')}
                  className="px-5 py-2.5 rounded-full border-2 border-white/60 text-white text-sm font-semibold hover:bg-white/10 transition-colors"
                >
                  Compose a Legacy
                </button>
              </div>
              {/* Decorative envelope lines */}
              <div className="mt-2 space-y-2 opacity-30">
                {[80, 60, 70, 50].map((w, i) => (
                  <div key={i} className="h-1.5 bg-white rounded-full" style={{ width: `${w}%` }} />
                ))}
              </div>
            </div>

            {/* Card 3 — Evolve: Recipe Tree */}
            <div className="bg-[#E8F5E0] rounded-3xl p-8 flex flex-col gap-5">
              <div className="w-10 h-10 bg-green-600/10 rounded-xl flex items-center justify-center">
                <Utensils className="w-5 h-5 text-green-700" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-bark mb-2">Evolve: Recipe Tree</h3>
                <p className="text-bark-light text-sm leading-relaxed">
                  Recipes aren't static. Watch how Grandma's pasta evolved through three generations, with notes, variations, and photo logs of every holiday meal.
                </p>
              </div>
              {/* Avatar stack */}
              <div className="flex items-center gap-2 mt-auto">
                <div className="flex">
                  {['bg-hearth', 'bg-amber-400', 'bg-green-500', 'bg-blue-400'].map((c, i) => (
                    <div
                      key={i}
                      className={`w-8 h-8 rounded-full ${c} border-2 border-[#E8F5E0] -ml-2 first:ml-0 flex items-center justify-center text-white text-xs font-bold`}
                    >
                      {['G', 'M', 'D', '+'][i]}
                    </div>
                  ))}
                </div>
                <span className="text-xs text-bark-light font-medium">+12 family members</span>
              </div>
            </div>

            {/* Card 4 — Create: Scrapbook */}
            <div className="bg-cream-dark rounded-3xl p-8 flex flex-col gap-4">
              <div>
                <h3 className="text-xl font-bold text-bark mb-2">Create: Scrapbook</h3>
                <p className="text-bark-light text-sm leading-relaxed">
                  The anti-feed. A non-linear, tactile digital canvas where you drag, drop, and layer your family's favorite moments into stunning interactive spreads.
                </p>
              </div>
              {/* Photo grid */}
              <div className="grid grid-cols-2 gap-2 mt-auto">
                <div className="h-24 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 overflow-hidden">
                  <div className="w-full h-full bg-gradient-to-br from-orange-300 via-pink-300 to-purple-400 opacity-80" />
                </div>
                <div className="flex flex-col gap-2">
                  <div className="h-11 rounded-xl bg-gradient-to-br from-yellow-300 to-amber-500" />
                  <div className="h-11 rounded-xl bg-bark/10 flex items-center justify-center">
                    <span className="text-xs font-semibold text-bark-light">July '24 Roadtrip</span>
                  </div>
                </div>
              </div>
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
                Our Privacy Manifesto
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold text-bark leading-tight mb-6">
                Your data is a{' '}
                <em className="italic underline decoration-hearth decoration-2">sacred legacy</em>
                , not a training set.
              </h2>
              <ul className="space-y-6">
                {[
                  {
                    icon: <Ban className="w-5 h-5 text-red-500" />,
                    title: 'No AI Training',
                    desc: 'We strictly prohibit the use of your private photos or text for LLM or AI generative model training. Ever.',
                  },
                  {
                    icon: <Shield className="w-5 h-5 text-hearth" />,
                    title: 'Zero-Knowledge Architecture',
                    desc: "Your 'Black Box' content is encrypted locally. Even our engineers can't see your family photos.",
                  },
                  {
                    icon: <X className="w-5 h-5 text-bark-light" />,
                    title: 'Ad-Free Forever',
                    desc: 'We are funded by families, for families. We will never sell your attention to advertisers.',
                  },
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
                { value: '100%', label: 'PRIVATE OWNERSHIP', color: 'text-hearth' },
                { icon: <Lock className="w-8 h-8 text-amber-600" />, label: 'E2E ENCRYPTION', color: '' },
                { icon: <Check className="w-8 h-8 text-green-600" />, label: 'VERIFIED MEMBERS ONLY', color: '' },
                { value: '0', label: 'DATA BREACHES', color: 'text-bark' },
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
            Ready to bring your family home?
          </h2>
          <p className="text-bark-light text-lg mb-10">
            Join the exclusive circle of families preserving their stories with dignity and style. Invite-only access ensures the highest standards of safety.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-4">
            <button
              onClick={() => navigate('/signup')}
              className="btn-hearth text-base px-8 py-3"
            >
              Request My Invite
            </button>
            <button
              className="px-8 py-3 rounded-full border-2 border-bark-muted text-bark font-semibold hover:border-bark transition-colors text-base"
            >
              Learn about Pricing
            </button>
          </div>
          <p className="text-xs text-bark-muted">No credit card required to join the waitlist.</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-cream border-t border-cream-dark py-8">
        <div className="max-w-6xl mx-auto px-5 flex flex-col items-center gap-5">
          {/* Logo */}
          <div className="flex items-center gap-2 text-bark font-bold">
            <Home className="w-4 h-4 text-hearth" />
            <span>FamilyHearth</span>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap justify-center gap-6 text-xs font-semibold text-bark-muted tracking-wider uppercase">
            {['Terms of Service', 'Privacy Policy', 'Help Center', 'Contact Us'].map((link) => (
              <a key={link} href="#" className="hover:text-bark transition-colors">
                {link}
              </a>
            ))}
          </nav>

          {/* Safety guidelines */}
          <a href="#" className="text-xs text-bark-muted hover:text-bark transition-colors tracking-wider uppercase">
            Safety Guidelines
          </a>

          {/* Copyright */}
          <p className="text-xs text-bark-muted text-center">
            &copy; {new Date().getFullYear()} FamilyHearth. All rights reserved.{' '}
            <span className="text-bark-muted">Crafted for memories.</span>
          </p>
        </div>
      </footer>
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
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
  GitFork,
  Star,
  Camera,
  Video,
  Mic,
  Users,
  KeyRound,
  Scissors,
  Layers,
} from 'lucide-react'
import { useState } from 'react'

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
  const { isAuthenticated } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)


  return (
    <div className="min-h-screen bg-cream font-sans">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-50 bg-cream border-b border-cream-dark">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 text-bark font-bold text-lg">
            <Home className="w-5 h-5 text-kaydo" />
            <span>Kaydo</span>
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
              onClick={() => navigate(isAuthenticated ? '/home' : '/login?admin=1')}
              className="btn-kaydo text-sm px-5 py-2"
            >
              Login
            </button>
            <button
              className="md:hidden text-bark-light hover:text-bark"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
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
            Your Private Digital Home
          </div>
          <h1 className="text-5xl lg:text-6xl font-bold text-bark leading-tight mb-5">
            Preserving the{' '}
            <em className="not-italic font-serif text-kaydo italic">Soul</em>{' '}
            of Family.
          </h1>
          <p className="text-bark-light text-lg leading-relaxed mb-8 max-w-md">
            A curated sanctuary for your family's narratives. No algorithms, no ads, no AI training. Just pure, unadulterated memories.
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => navigate(isAuthenticated ? '/home' : '/signup')}
              className="btn-kaydo text-base px-8 py-3"
            >
              Get Started
            </button>
            <button
              onClick={() => navigate(isAuthenticated ? '/home' : '/login?admin=1')}
              className="px-8 py-3 rounded-full border-2 border-bark-muted text-bark font-semibold hover:border-bark transition-colors text-base"
            >
              Login
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
              <div className="w-7 h-7 bg-kaydo rounded-lg flex items-center justify-center">
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
              {['bg-kaydo', 'bg-amber-400', 'bg-green-400'].map((c, i) => (
                <div key={i} className={`w-5 h-5 rounded-full ${c} border-2 border-white -ml-1 first:ml-0`} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Six Pillars ── */}
      <section id="features" className="bg-warm-white py-20">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-bark mb-3">Six Pillars of Kaydo</h2>
            <p className="text-bark-light max-w-md mx-auto">
              Thoughtfully engineered spaces designed to nurture legacy and foster deep connections across generations.
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
                <h3 className="text-xl font-bold text-bark mb-2">Share: Moments &amp; Memories</h3>
                <p className="text-bark-light text-sm leading-relaxed mb-6 max-w-lg">
                  Every candid snapshot, milestone video, and voice memo — gathered in one warm, private feed. Your inner circle gets instant access with just a shared family password. No accounts, no friction, no strangers.
                </p>
                <ul className="space-y-2">
                  {[
                    'Inner circle access — one shared password, zero sign-ups',
                    'Family admin controls who sees what and when',
                    'Post, pin, and curate from a simple dashboard',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-bark">
                      <Check className="w-4 h-4 text-kaydo mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right — media type badges + access illustration */}
              <div className="flex flex-col gap-4 lg:w-64 w-full">
                {/* Media type pills */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { icon: <Camera className="w-4 h-4" />, label: 'Photos' },
                    { icon: <Video className="w-4 h-4" />, label: 'Videos' },
                    { icon: <Mic className="w-4 h-4" />, label: 'Voice Memos' },
                  ].map(({ icon, label }) => (
                    <div key={label} className="flex items-center gap-2 bg-white rounded-full px-4 py-2 text-sm font-medium text-bark shadow-sm border border-cream-dark">
                      <span className="text-kaydo">{icon}</span>
                      {label}
                    </div>
                  ))}
                </div>

                {/* Access card */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-dark">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-kaydo/10 rounded-xl flex items-center justify-center">
                      <Users className="w-4 h-4 text-kaydo" />
                    </div>
                    <span className="text-sm font-semibold text-bark">Inner Circle</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-bark-light mb-3">
                    <KeyRound className="w-3.5 h-3.5 text-bark-muted" />
                    <span>One shared family password</span>
                  </div>
                  <div className="flex gap-1">
                    {['bg-kaydo', 'bg-amber-400', 'bg-green-500', 'bg-blue-400', 'bg-purple-400'].map((c, i) => (
                      <div key={i} className={`w-7 h-7 rounded-full ${c} border-2 border-white -ml-1.5 first:ml-0`} />
                    ))}
                    <div className="w-7 h-7 rounded-full bg-cream-dark border-2 border-white -ml-1.5 flex items-center justify-center text-xs font-bold text-bark-light">
                      +
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 2 — Preserve: The Vault */}
            <div className="bg-cream-dark rounded-3xl p-8 flex flex-col gap-5">
              <div className="w-10 h-10 bg-kaydo/10 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-kaydo" />
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
                    <Check className="w-4 h-4 text-kaydo" />
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
            <div className="bg-kaydo rounded-3xl p-8 flex flex-col gap-5">
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
                  onClick={() => navigate(isAuthenticated ? '/home' : '/login?admin=1')}
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
                  {['bg-kaydo', 'bg-amber-400', 'bg-green-500', 'bg-blue-400'].map((c, i) => (
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

            {/* Card 5 — Create: Digital Scrapbook (full-width) */}
            <div className="md:col-span-2 bg-[#EDE9F5] rounded-3xl p-8 flex flex-col lg:flex-row gap-8 items-start">
              {/* Left — text */}
              <div className="flex-1">
                <div className="w-10 h-10 bg-violet-600/10 rounded-xl flex items-center justify-center mb-5">
                  <Scissors className="w-5 h-5 text-violet-700" />
                </div>
                <h3 className="text-xl font-bold text-bark mb-2">Create: Digital Scrapbook</h3>
                <p className="text-bark-light text-sm leading-relaxed mb-6 max-w-lg">
                  Turn your family memories into handcrafted digital pages. Drag and drop polaroid photos, playful stickers, and personal notes onto a freeform canvas — then export your finished book as a PDF to print or share.
                </p>
                <ul className="space-y-2">
                  {[
                    { icon: <Layers className="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0" />, text: 'Drag-and-drop canvas with photos, stickers & text' },
                    { icon: <Check className="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0" />, text: 'Polaroid-style photo frames with rotation & resize' },
                    { icon: <Check className="w-4 h-4 text-violet-600 mt-0.5 flex-shrink-0" />, text: 'Export finished scrapbooks to PDF' },
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
                  Open Scrapbooks
                </button>
              </div>

              {/* Right — decorative canvas preview */}
              <div className="lg:w-72 w-full flex-shrink-0">
                <div
                  className="relative rounded-2xl overflow-hidden h-52 lg:h-64"
                  style={{
                    backgroundColor: '#FDF6EC',
                    backgroundImage: 'radial-gradient(circle, #C8B4A020 1.5px, transparent 1.5px)',
                    backgroundSize: '20px 20px',
                  }}
                >
                  {/* Polaroid — rotated left */}
                  <div
                    className="absolute bg-white shadow-lg rounded-sm p-2 pb-7 w-32"
                    style={{ top: '20px', left: '24px', transform: 'rotate(-6deg)' }}
                  >
                    <div className="w-full h-20 bg-gradient-to-br from-amber-200 to-amber-400 rounded-sm" />
                    <div className="absolute bottom-1.5 left-0 right-0 text-center text-[9px] font-medium text-bark-light tracking-wide">
                      Summer 2024
                    </div>
                  </div>

                  {/* Polaroid — rotated right */}
                  <div
                    className="absolute bg-white shadow-md rounded-sm p-2 pb-7 w-28"
                    style={{ top: '30px', left: '120px', transform: 'rotate(5deg)' }}
                  >
                    <div className="w-full h-16 bg-gradient-to-br from-violet-200 to-violet-400 rounded-sm" />
                    <div className="absolute bottom-1.5 left-0 right-0 text-center text-[9px] font-medium text-bark-light tracking-wide">
                      Family Trip
                    </div>
                  </div>

                  {/* Emoji stickers */}
                  <div className="absolute text-2xl" style={{ top: '12px', right: '24px', transform: 'rotate(12deg)' }}>⭐</div>
                  <div className="absolute text-xl" style={{ bottom: '40px', left: '30px', transform: 'rotate(-8deg)' }}>🌸</div>
                  <div className="absolute text-xl" style={{ bottom: '36px', right: '32px' }}>🎀</div>

                  {/* Text label element */}
                  <div
                    className="absolute bg-amber-100 border border-amber-300 rounded-lg px-3 py-1.5 shadow-sm"
                    style={{ bottom: '16px', left: '50%', transform: 'translateX(-50%) rotate(2deg)' }}
                  >
                    <span className="text-xs font-semibold text-amber-800 whitespace-nowrap font-serif italic">
                      Our Family Story
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Card 6 — Open Source */}
            <div className="bg-bark rounded-3xl p-8 flex flex-col gap-5">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <OctocatIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Open Source</h3>
                <p className="text-white/70 text-sm leading-relaxed">
                  Kaydo is built in the open. Audit the code, contribute features, or self-host for your family. No black boxes — except the ones you create.
                </p>
              </div>
              {/* Stats row */}
              <div className="flex gap-4 mt-auto">
                <div className="flex items-center gap-1.5 text-white/60 text-xs font-medium">
                  <Star className="w-3.5 h-3.5" />
                  <span>Star us</span>
                </div>
                <div className="flex items-center gap-1.5 text-white/60 text-xs font-medium">
                  <GitFork className="w-3.5 h-3.5" />
                  <span>Fork &amp; self-host</span>
                </div>
              </div>
              <a
                href="https://github.com/Gnadi/0815memories"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-white/30 text-white text-sm font-semibold hover:bg-white/10 transition-colors w-fit"
              >
                <OctocatIcon className="w-4 h-4" />
                View on GitHub
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
                Our Privacy Manifesto
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold text-bark leading-tight mb-6">
                Your data is a{' '}
                <em className="italic underline decoration-kaydo decoration-2">sacred legacy</em>
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
                    icon: <Shield className="w-5 h-5 text-kaydo" />,
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
                { value: '100%', label: 'PRIVATE OWNERSHIP', color: 'text-kaydo' },
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
              onClick={() => navigate(isAuthenticated ? '/home' : '/signup')}
              className="btn-kaydo text-base px-8 py-3"
            >
              Get Started
            </button>
            <a
              href="https://github.com/Gnadi/0815memories"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-8 py-3 rounded-full border-2 border-bark-muted text-bark font-semibold hover:border-bark transition-colors text-base"
            >
              <OctocatIcon className="w-5 h-5" />
              Open Source
            </a>
          </div>
          <p className="text-xs text-bark-muted">No credit card required, it's free.</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-cream border-t border-cream-dark py-8">
        <div className="max-w-6xl mx-auto px-5 flex flex-col items-center gap-5">
          {/* Logo */}
          <div className="flex items-center gap-2 text-bark font-bold">
            <Home className="w-4 h-4 text-kaydo" />
            <span>Kaydo</span>
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
            &copy; {new Date().getFullYear()} Kaydo. All rights reserved.{' '}
            <span className="text-bark-muted">Crafted for memories.</span>
          </p>
        </div>
      </footer>
    </div>
  )
}

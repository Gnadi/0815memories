import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../context/AuthContext'
import { Shield, X } from 'lucide-react'
import KaydoLogo from '../components/KaydoLogo'
import FamilyIllustration from '../components/FamilyIllustration'
import LoginForm, { SetupBanner } from '../components/auth/LoginForm'
import CustomLoginCanvas from '../components/CustomLoginCanvas'
import LoginDecorations from '../components/LoginDecorations'
import { themeToStyles, themeDecorationEmojis, themeText } from '../utils/loginTheme'
import { normalizeLoginCard, CARD_STYLES } from '../utils/loginCard'
import { resolveFamilyBySlug, getSubdomainSlug } from '../utils/familySlug'

function toResolvedFamily(data) {
  if (!data) return null
  return {
    name: data.familyName || '',
    headerImage: data.loginHeaderImage || '',
    pageMode: data.loginPageMode || 'classic',
    theme: data.loginTheme || null,
    customHtml: data.loginCustomHtml || '',
    customCss: data.loginCustomCss || '',
    card: data.loginCard || null,
    isDemo: data.isDemo === true,
  }
}

// Snapshot of the last successful family resolution, keyed by the slug or
// family id used to look it up. Lets returning visitors get their custom
// design on the first paint instead of a flash of the default page; the
// fresh Firestore fetch still runs and updates the snapshot afterwards.
// Only ever rendered through the same validated/sanitized paths as live data.
const LOGIN_CACHE_PREFIX = 'kaydo_login_page:'

function readCachedFamily(key) {
  if (!key || typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LOGIN_CACHE_PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeCachedFamily(key, family) {
  if (!key || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOGIN_CACHE_PREFIX + key, JSON.stringify(family))
  } catch {
    // Storage full or unavailable — the page just keeps the one-time swap.
  }
}

export default function LoginPage() {
  const { t } = useTranslation('auth')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [stayLoggedIn, setStayLoggedIn] = useState(false)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Custom pages with a minimized login box open the form as an overlay.
  const [loginOpen, setLoginOpen] = useState(false)

  useEffect(() => {
    if (!loginOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setLoginOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [loginOpen])

  const { loginAsViewer, loginAsDemo, loginAsAdmin, isAuthenticated, firebaseReady } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { slug: routeSlug } = useParams()
  const urlFamilyId = searchParams.get('family')
  const adminParam = searchParams.get('admin')

  // Key the family is looked up by: slug (route param or subdomain) first,
  // ?family= id as fallback. Empty on a plain /login visit.
  const lookupKey = routeSlug || getSubdomainSlug() || urlFamilyId || ''

  // Family resolution state, seeded from the localStorage snapshot so the
  // custom design paints immediately on repeat visits. `resolving` is true
  // only while we have a family to look up and nothing cached to show yet.
  const [resolvedFamilyId, setResolvedFamilyId] = useState(null)
  const [resolvedFamily, setResolvedFamily] = useState(() => readCachedFamily(lookupKey))
  const [resolving, setResolving] = useState(() => !!lookupKey && !readCachedFamily(lookupKey))

  // Safety valve: never hold the neutral loading shell for more than a few
  // seconds (e.g. Firestore unreachable) — fall back to the default page.
  useEffect(() => {
    if (!resolving) return
    const id = setTimeout(() => setResolving(false), 5000)
    return () => clearTimeout(id)
  }, [resolving])

  useEffect(() => {
    if (adminParam === '1') setShowAdminLogin(true)
  }, [adminParam])

  // Resolve family from slug (route param or subdomain) on mount
  useEffect(() => {
    const slug = routeSlug || getSubdomainSlug()
    if (!slug) return

    resolveFamilyBySlug(slug)
      .then((family) => {
        if (family) {
          const resolved = toResolvedFamily(family)
          setResolvedFamilyId(family.id)
          setResolvedFamily(resolved)
          writeCachedFamily(slug, resolved)
        } else {
          setError(t('login.errors.familyNotFound'))
        }
      })
      .catch(() => setError(t('login.errors.couldNotLoadFamily')))
      .finally(() => setResolving(false))
  }, [routeSlug, t])

  // Load customization for families accessed via ?family= query param (no slug)
  useEffect(() => {
    if (!urlFamilyId || resolvedFamilyId) return
    if (!db) {
      setResolving(false)
      return
    }
    getDoc(doc(db, 'families', urlFamilyId))
      .then((snap) => {
        if (snap.exists()) {
          const resolved = toResolvedFamily(snap.data())
          setResolvedFamily(resolved)
          writeCachedFamily(urlFamilyId, resolved)
        }
      })
      .catch(() => {})
      .finally(() => setResolving(false))
  }, [urlFamilyId, resolvedFamilyId])

  // The effective familyId: resolved slug takes priority, then query param fallback
  const effectiveFamilyId = resolvedFamilyId || urlFamilyId

  if (isAuthenticated) {
    navigate('/home', { replace: true })
    return null
  }

  // While looking up a family with nothing cached to show, render a neutral
  // shell instead of flashing the default design before the custom one loads.
  if (resolving && !resolvedFamily) {
    return (
      <div className="min-h-dvh bg-cream flex items-center justify-center" aria-busy="true">
        <div className="animate-pulse">
          <KaydoLogo size={48} />
        </div>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (showAdminLogin && email) {
        await loginAsAdmin(email, password)
      } else {
        if (!effectiveFamilyId) {
          setError(t('login.errors.needFamilyLink'))
          setLoading(false)
          return
        }
        await loginAsViewer(password, effectiveFamilyId)
      }
      if (!stayLoggedIn) {
        sessionStorage.setItem('fh_session', 'true')
      }
      navigate('/home')
    } catch (err) {
      setError(
        err.code === 'auth/invalid-credential'
          ? t('login.errors.invalidCredential')
          : t('login.errors.generic')
      )
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    setError('')
    if (!effectiveFamilyId) {
      setError(t('login.errors.needFamilyLink'))
      return
    }
    setLoading(true)
    try {
      await loginAsDemo(effectiveFamilyId)
      sessionStorage.setItem('fh_session', 'true')
      navigate('/home')
    } catch {
      setError(t('login.errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  const formProps = {
    showAdminLogin, email, setEmail, password, setPassword,
    showPassword, setShowPassword, stayLoggedIn, setStayLoggedIn,
    error, loading, handleSubmit,
    isDemo: !!resolvedFamily?.isDemo, handleDemoLogin,
  }

  const resolvedFamilyName = resolvedFamily?.name || null
  const resolvedFamilyHeaderImage = resolvedFamily?.headerImage || ''

  // ====== CUSTOM MODE (admin-authored HTML/CSS, sanitized + shadow-DOM) ======
  if (resolvedFamily?.pageMode === 'custom' && resolvedFamily.customHtml) {
    const { behavior, style } = normalizeLoginCard(resolvedFamily.card)
    const cardProps = {
      t, navigate, formProps, firebaseReady,
      familyName: resolvedFamilyName,
      showAdminLogin, setShowAdminLogin,
      styleKey: style,
    }
    return (
      <div className="relative min-h-dvh bg-cream">
        {/* Login UI first in DOM (keyboard/screen-reader priority), painted
            above the canvas via z-10/z-20 */}
        {behavior === 'minimized' ? (
          <>
            {!loginOpen && (
              <div className="fixed bottom-5 inset-x-0 z-10 flex justify-center pointer-events-none px-4">
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className="pointer-events-auto flex items-center gap-2 bg-warm-white/95 backdrop-blur text-bark font-semibold rounded-full shadow-2xl px-6 py-3 hover:scale-[1.03] transition-transform"
                >
                  <KaydoLogo size={20} />
                  {t('login.openLogin')}
                </button>
              </div>
            )}
            {loginOpen && (
              <div
                className="fixed inset-0 z-20 overflow-y-auto flex items-start sm:items-center justify-center p-4"
                role="dialog"
                aria-modal="true"
              >
                <div
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                  onClick={() => setLoginOpen(false)}
                />
                <CustomLoginCard
                  {...cardProps}
                  onClose={() => setLoginOpen(false)}
                  autoFocusPassword
                />
              </div>
            )}
          </>
        ) : (
          <div className="fixed inset-0 z-10 overflow-y-auto pointer-events-none flex items-start sm:items-center justify-center p-4">
            <CustomLoginCard {...cardProps} />
          </div>
        )}

        <div className="fixed inset-0">
          <CustomLoginCanvas
            html={resolvedFamily.customHtml}
            css={resolvedFamily.customCss}
          />
        </div>
      </div>
    )
  }

  // ====== THEME MODE (structured, validated styling of the standard layout) ======
  const isThemed = resolvedFamily?.pageMode === 'theme'
  const { pageStyle, headingStyle, textStyle, accentColor } = isThemed
    ? themeToStyles(resolvedFamily.theme)
    : { pageStyle: {}, headingStyle: {}, textStyle: {}, accentColor: '' }
  const themedCardStyle = accentColor ? { borderTop: `4px solid ${accentColor}` } : {}
  const decorationEmojis = isThemed ? themeDecorationEmojis(resolvedFamily.theme) : []
  const welcomeTitleOverride = isThemed ? themeText(resolvedFamily.theme, 'welcomeTitle') : ''
  const welcomeMessageOverride = isThemed ? themeText(resolvedFamily.theme, 'welcomeMessage') : ''

  const welcomeHeading = welcomeTitleOverride
    || (resolvedFamilyName
      ? t('login.welcomeFamily', { name: resolvedFamilyName })
      : t('login.welcomeHome'))
  const welcomeSubtitle = welcomeMessageOverride || t('login.subtitle')

  return (
    <div className="relative min-h-dvh bg-cream flex flex-col" style={pageStyle}>
      {isThemed && <LoginDecorations emojis={decorationEmojis} />}

      {/* Desktop header — hidden on mobile */}
      <header className="relative hidden lg:flex px-6 py-4 items-center justify-between">
        <div className="flex items-center gap-2 text-bark font-semibold text-lg" style={headingStyle}>
          <KaydoLogo size={22} />
          <span>Kaydo</span>
        </div>
      </header>

      {/* Main content */}
      <main className="relative flex-1 flex flex-col lg:flex-row items-stretch">
        {/* ====== MOBILE LAYOUT (< lg) ====== */}
        {/* Fills exactly one phone screen (h-dvh, no scroll). The photo/illustration
            is the flex-grow element, so it expands to absorb any leftover vertical
            space — no empty gap — and shrinks (min-h-0) if content ever gets tall. */}
        <div className={`lg:hidden h-dvh flex flex-col px-5 pt-4 ${isThemed ? 'pb-6' : 'pb-8'}`}>
          {/* Mobile brand */}
          <div className="flex items-center gap-2 mb-4">
            <KaydoLogo size={22} />
            <span className="text-lg font-bold text-bark" style={headingStyle}>Kaydo</span>
          </div>

          {/* Illustration card — themed pages only keep it when the family
              uploaded a photo; the default illustration clashes with themes */}
          {(!isThemed || resolvedFamilyHeaderImage) && (
            <div className={`rounded-2xl overflow-hidden flex-1 min-h-0 ${isThemed ? 'mb-4' : 'mb-6'}`}>
              {resolvedFamilyHeaderImage
                ? <img src={resolvedFamilyHeaderImage} alt={t('familyImageAlt')} className="w-full h-full object-cover" />
                : <FamilyIllustration />}
            </div>
          )}

          {/* Welcome heading */}
          <h1 className="text-3xl font-bold text-bark text-center mb-2" style={headingStyle}>
            {welcomeHeading}
          </h1>
          <p className={`text-bark-light text-center ${isThemed ? 'mb-4' : 'mb-6'}`} style={textStyle}>
            {welcomeSubtitle}
          </p>

          {!firebaseReady && <SetupBanner />}

          {/* Form */}
          {isThemed
            ? (
              <div className="bg-warm-white/90 backdrop-blur rounded-2xl shadow-lg p-5" style={themedCardStyle}>
                <LoginForm {...formProps} />
              </div>
            )
            : <LoginForm {...formProps} />}

          {/* Admin toggle */}
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setShowAdminLogin(!showAdminLogin)}
              className="text-sm text-bark-muted hover:text-kaydo transition-colors"
              style={textStyle}
            >
              {showAdminLogin ? t('login.backToFamily') : t('login.adminLogin')}
            </button>
          </div>

          {/* Sign up — admin login only */}
          {showAdminLogin && (
            <div className="mt-6 text-center">
              <button
                onClick={() => navigate('/signup')}
                className="w-full py-3 border-2 border-cream-dark rounded-full text-kaydo font-semibold hover:bg-cream-dark transition-colors"
              >
                {t('login.createAccount')}
              </button>
            </div>
          )}
        </div>

        {/* ====== DESKTOP LAYOUT (>= lg) ====== */}
        {/* Left — Illustration */}
        <div className={`hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center p-12 ${isThemed ? '' : 'bg-cream-dark'}`}>
          {resolvedFamilyHeaderImage
            ? <img src={resolvedFamilyHeaderImage} alt={t('familyImageAlt')} className="absolute inset-0 w-full h-full object-cover" />
            : <FamilyIllustration />}
          <div className="absolute bottom-8 left-8 right-8 text-white">
            <h2 className="text-3xl font-bold mb-2 drop-shadow-lg">
              {t('login.asideTitle')}
            </h2>
            <p className="text-base opacity-90 drop-shadow">
              {t('login.asideBody')}
            </p>
          </div>
        </div>

        {/* Right — Login Form */}
        <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center px-16">
          <div
            className={`w-full max-w-md ${isThemed ? 'bg-warm-white/90 backdrop-blur rounded-2xl shadow-lg p-8' : ''}`}
            style={isThemed ? themedCardStyle : undefined}
          >
            {/* Logo mark */}
            <div className="flex justify-center mb-6">
              <KaydoLogo size={52} />
            </div>

            <h1 className="text-4xl font-bold text-bark text-center mb-2">
              {welcomeHeading}
            </h1>
            <p className="text-bark-light text-center mb-8">
              {welcomeSubtitle}
            </p>

            {!firebaseReady && <SetupBanner />}

            <LoginForm {...formProps} />

            {/* Admin toggle */}
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setShowAdminLogin(!showAdminLogin)}
                className="text-sm text-bark-muted hover:text-kaydo transition-colors"
              >
                {showAdminLogin ? t('login.backToFamily') : t('login.adminLogin')}
              </button>
            </div>

            {/* Sign up — admin login only */}
            {showAdminLogin && (
              <div className="mt-6 text-center">
                <p className="text-sm text-bark-light mb-3">{t('login.newToFamily')}</p>
                <button
                  onClick={() => navigate('/signup')}
                  className="w-full py-3 border-2 border-cream-dark rounded-full text-kaydo font-semibold hover:bg-cream-dark transition-colors"
                >
                  {t('login.createAccount')}
                </button>
              </div>
            )}

            {/* Secure badge */}
            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-bark-muted">
              <Shield className="w-4 h-4" />
              {t('secureBadge')}
            </div>
          </div>
        </div>
      </main>

      {/* Footer — desktop only */}
      <footer className="relative hidden lg:flex px-6 py-4 items-center justify-between text-xs text-bark-muted border-t border-cream-dark">
        <p>{t('footer.copyright', { year: new Date().getFullYear() })}</p>
        <div className="flex gap-4">
          <span className="hover:text-bark cursor-pointer">{t('footer.privacy')}</span>
          <span className="hover:text-bark cursor-pointer">{t('footer.terms')}</span>
          <span className="hover:text-bark cursor-pointer">{t('footer.help')}</span>
        </div>
      </footer>
    </div>
  )
}

// The native login card shown on custom-designed pages, either always
// visible or opened from the floating "Sign in" pill. Its look follows the
// admin-picked preset (CARD_STYLES); the form itself is always native UI.
function CustomLoginCard({
  t, navigate, formProps, firebaseReady, familyName,
  showAdminLogin, setShowAdminLogin, styleKey, onClose, autoFocusPassword = false,
}) {
  const preset = CARD_STYLES[styleKey] || CARD_STYLES.light
  const dark = preset.tone === 'dark'
  return (
    <div className={`pointer-events-auto relative w-full max-w-md my-8 rounded-2xl shadow-2xl p-6 ${preset.cardClass}`}>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={t('login.closeLogin')}
          className={`absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            dark ? 'text-cream/70 hover:text-cream hover:bg-white/10' : 'text-bark-muted hover:text-bark hover:bg-cream-dark'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <div className="flex justify-center mb-4">
        <KaydoLogo size={40} />
      </div>
      <h1 className={`text-2xl font-bold text-center mb-1 ${dark ? 'text-cream' : 'text-bark'}`}>
        {familyName
          ? t('login.welcomeFamily', { name: familyName })
          : t('login.welcomeHome')}
      </h1>
      <p className={`text-center text-sm mb-5 ${dark ? 'text-cream/80' : 'text-bark-light'}`}>
        {t('login.subtitle')}
      </p>

      {!firebaseReady && <SetupBanner />}

      <LoginForm {...formProps} tone={preset.tone} autoFocusPassword={autoFocusPassword} />

      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => setShowAdminLogin(!showAdminLogin)}
          className={`text-sm transition-colors ${dark ? 'text-cream/70 hover:text-cream' : 'text-bark-muted hover:text-kaydo'}`}
        >
          {showAdminLogin ? t('login.backToFamily') : t('login.adminLogin')}
        </button>
      </div>

      {showAdminLogin && (
        <div className="mt-4 text-center">
          <button
            onClick={() => navigate('/signup')}
            className={`w-full py-3 border-2 rounded-full font-semibold transition-colors ${
              dark ? 'border-white/20 text-cream hover:bg-white/10' : 'border-cream-dark text-kaydo hover:bg-cream-dark'
            }`}
          >
            {t('login.createAccount')}
          </button>
        </div>
      )}
    </div>
  )
}

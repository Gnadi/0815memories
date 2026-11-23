import { useState, useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { Head } from 'vite-react-ssg'
import { db } from '../config/firebase'
import { useAuth } from '../context/AuthContext'
import { Link2, Shield, X } from 'lucide-react'
import KaydoLogo from '../components/KaydoLogo'
import LoginArt from '../components/auth/LoginArt'
import LoginForm, { SetupBanner } from '../components/auth/LoginForm'
import CustomLoginCanvas from '../components/CustomLoginCanvas'
import LoginDecorations from '../components/LoginDecorations'
import { themeToStyles, themeDecorationEmojis, themeText } from '../utils/loginTheme'
import { normalizeLoginCard, CARD_STYLES } from '../utils/loginCard'
import { getSubdomainSlug } from '../utils/familySlug'
import { getFamilyPublic, resolveFamilyBySlug } from '../services/family'
import useDialogFocus from '../hooks/useDialogFocus'
import AuthFooter from '../components/auth/AuthFooter'
import { safeNextPath } from '../utils/nextPath'

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
  }
}

// Firebase Auth errors on the admin login that may be shown as they are: they
// say nothing about whether an account exists. Every other code, user-disabled
// among them, reads as the generic line. A project without email enumeration
// protection answers user-not-found and wrong-password instead of
// invalid-credential; both read the same, so neither tells them apart.
const ADMIN_ERROR_KEYS = {
  'auth/invalid-credential': 'login.errors.invalidCredential',
  'auth/user-not-found': 'login.errors.invalidCredential',
  'auth/wrong-password': 'login.errors.invalidCredential',
  'auth/invalid-email': 'login.errors.invalidEmail',
  'auth/missing-email': 'login.errors.invalidEmail',
  'auth/too-many-requests': 'login.errors.tooManyRequests',
  'auth/network-request-failed': 'login.errors.network',
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

// The tab and bookmark name. /login is served the landing page's HTML, whose
// title ("Kaydo – Free, Private & Encrypted…") stayed in place while
// someone signed in — in English, whatever the page's language.
export default function LoginPage() {
  const { t } = useTranslation('auth')
  return (
    <>
      <Head>
        <title>{t('login.pageTitle')}</title>
      </Head>
      <LoginPageContent />
    </>
  )
}

function LoginPageContent() {
  const { t } = useTranslation('auth')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  // On by default: a family album is a place you come back to, not a bank. The
  // box now genuinely decides how long the session lives (see AuthContext) —
  // before, it wrote a sessionStorage flag nothing ever read, so every login
  // was remembered forever regardless of what the box said.
  const [stayLoggedIn, setStayLoggedIn] = useState(true)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  // "Forgot password", shown in place of the admin form.
  const [resetOpen, setResetOpen] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Custom pages with a minimized login box open the form as an overlay.
  const [loginOpen, setLoginOpen] = useState(false)
  const loginDialogRef = useRef(null)
  const loginOpenButtonRef = useRef(null)
  const loginDialogTitleId = useId()
  useDialogFocus(loginDialogRef, loginOpen, loginOpenButtonRef)

  useEffect(() => {
    if (!loginOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setLoginOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [loginOpen])

  const { loginAsViewer, loginAsAdmin, isAuthenticated, firebaseReady } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { slug: routeSlug } = useParams()
  const urlFamilyId = searchParams.get('family')
  const adminParam = searchParams.get('admin')
  // Where the visitor was going when they were sent here (ProtectedRoute).
  const afterLogin = safeNextPath(searchParams.get('next')) || '/home'

  // Key the family is looked up by: slug (route param or subdomain) first,
  // ?family= id as fallback. Empty on a plain /login visit.
  // On a slug or subdomain page the family is fixed by the address; a
  // ?family= id there would only let a crafted link put another family's
  // design on this family's login page.
  const hasSlug = !!(routeSlug || getSubdomainSlug())
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
    if (!urlFamilyId || resolvedFamilyId || hasSlug) return
    if (!db) {
      setResolving(false)
      return
    }
    getFamilyPublic(urlFamilyId)
      .then((data) => {
        if (data) {
          const resolved = toResolvedFamily(data)
          setResolvedFamily(resolved)
          writeCachedFamily(urlFamilyId, resolved)
        }
      })
      .catch(() => {})
      .finally(() => setResolving(false))
  }, [urlFamilyId, resolvedFamilyId, hasSlug])

  // The effective familyId: resolved slug takes priority, then query param fallback
  const effectiveFamilyId = resolvedFamilyId || (hasSlug ? null : urlFamilyId)

  // Already signed in — nothing to log into. Rendered as <Navigate> rather than
  // a navigate() call in the render body, which updates router state mid-render.
  if (isAuthenticated) {
    return <Navigate to={afterLogin} replace />
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
      // The admin form always signs in as an admin. It used to fall through to
      // the family login when the email was empty, which answered with "you
      // need a family link" to someone who had only forgotten a field.
      if (showAdminLogin) {
        await loginAsAdmin(email.trim(), password, { remember: stayLoggedIn })
      } else {
        if (!effectiveFamilyId) {
          setError(t('login.errors.needFamilyLink'))
          setLoading(false)
          return
        }
        await loginAsViewer(password, effectiveFamilyId, { remember: stayLoggedIn })
      }
      navigate(afterLogin, { replace: true })
    } catch (err) {
      // `i18nKey` marks the viewer-login messages, which are written to be
      // safe to display. Admin errors are shown only where ADMIN_ERROR_KEYS
      // lists them: a raw Firebase Auth error would tell a stranger whether an
      // account exists.
      setError(t(err.i18nKey || ADMIN_ERROR_KEYS[err.code] || 'login.errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  const formProps = {
    showAdminLogin, email, setEmail, password, setPassword,
    showPassword, setShowPassword, stayLoggedIn, setStayLoggedIn,
    error, loading, handleSubmit, resetOpen, setResetOpen,
  }

  const toggleAdminLogin = () => {
    setShowAdminLogin(!showAdminLogin)
    setResetOpen(false)
  }

  const resolvedFamilyName = resolvedFamily?.name || null
  const resolvedFamilyHeaderImage = resolvedFamily?.headerImage || ''

  // ====== CUSTOM MODE (admin-authored HTML/CSS, sanitized + shadow-DOM) ======
  if (resolvedFamily?.pageMode === 'custom' && resolvedFamily.customHtml) {
    const { behavior, style } = normalizeLoginCard(resolvedFamily.card)
    const cardProps = {
      t, navigate, formProps, firebaseReady,
      familyName: resolvedFamilyName,
      showAdminLogin, toggleAdminLogin,
      styleKey: style,
    }
    return (
      <div className="relative min-h-dvh bg-cream">
        {/* Login UI first in DOM (keyboard/screen-reader priority), painted
            above the canvas via z-10/z-20 */}
        {behavior === 'minimized' ? (
          <>
            {/* Hidden rather than unmounted while the dialog is open, so focus
                can come back to it when the dialog closes. */}
            <div className={`fixed bottom-5 inset-x-0 z-10 justify-center pointer-events-none px-4 ${loginOpen ? 'hidden' : 'flex'}`}>
              <button
                ref={loginOpenButtonRef}
                type="button"
                onClick={() => setLoginOpen(true)}
                className="pointer-events-auto flex items-center gap-2 bg-warm-white/95 backdrop-blur text-bark font-semibold rounded-full shadow-2xl px-6 py-3 hover:scale-[1.03] transition-transform"
              >
                <KaydoLogo size={20} />
                {t('login.openLogin')}
              </button>
            </div>
            {loginOpen && (
              <div
                ref={loginDialogRef}
                className="fixed inset-0 z-20 overflow-y-auto flex items-start sm:items-center justify-center p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby={loginDialogTitleId}
              >
                <div
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                  onClick={() => setLoginOpen(false)}
                />
                <CustomLoginCard
                  {...cardProps}
                  onClose={() => setLoginOpen(false)}
                  titleId={loginDialogTitleId}
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

        {/* Out of reach of keyboard and screen reader while the dialog is open */}
        <div className="fixed inset-0" inert={loginOpen || undefined}>
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
  const decorationEmojis = isThemed ? themeDecorationEmojis(resolvedFamily.theme) : []
  const welcomeTitleOverride = isThemed ? themeText(resolvedFamily.theme, 'welcomeTitle') : ''
  const welcomeMessageOverride = isThemed ? themeText(resolvedFamily.theme, 'welcomeMessage') : ''

  const welcomeHeading = welcomeTitleOverride
    || (resolvedFamilyName
      ? t('login.welcomeFamily', { name: resolvedFamilyName })
      : t('login.welcomeHome'))
  const welcomeSubtitle = welcomeMessageOverride || t('login.subtitle')

  // The page is one tree for every screen size. It used to be two, a phone
  // layout and a desktop layout, each with its own form: password managers
  // and screen readers met every field twice. What still differs is where
  // the themed card sits — around the form alone on a phone, with the
  // heading on the family's background, and around the whole column on a
  // desktop — so the theme's colours travel as variables that only the
  // phone classes read.
  const themeVars = {}
  if (headingStyle.color) themeVars['--login-heading'] = headingStyle.color
  if (textStyle.color) {
    themeVars['--login-text'] = textStyle.color
    themeVars['--login-text-opacity'] = textStyle.opacity
  }
  if (accentColor) themeVars['--login-accent'] = accentColor
  const phoneTextClass = 'max-lg:[color:var(--login-text,var(--color-bark-muted))] max-lg:[opacity:var(--login-text-opacity,1)]'
  // Written out in full rather than assembled: Tailwind only generates the
  // classes it finds spelled out in the source.
  const columnCardClass = isThemed
    ? `lg:bg-warm-white/90 lg:backdrop-blur lg:rounded-2xl lg:shadow-lg lg:p-8 ${accentColor ? 'lg:border-t-4 lg:border-[color:var(--login-accent)]' : ''}`
    : ''
  const formCardClass = isThemed
    ? `max-lg:bg-warm-white/90 max-lg:backdrop-blur max-lg:rounded-2xl max-lg:shadow-lg max-lg:p-5 ${accentColor ? 'max-lg:border-t-4 max-lg:border-[color:var(--login-accent)]' : ''}`
    : ''
  // Themed pages keep the phone's picture only when the family uploaded a
  // photo; the default illustration clashes with themes. The admin form
  // leaves it no room on a phone: it shrank to a sliver, or to nothing.
  const showPhonePicture = !showAdminLogin && (!isThemed || resolvedFamilyHeaderImage)
  // A plain /login visit names no family, and a family member's private key
  // means nothing without one. The field used to be shown anyway, and said
  // so only after it was filled in and sent.
  const needsFamilyLink = !showAdminLogin && !lookupKey

  return (
    <div className="relative min-h-dvh bg-cream flex flex-col" style={{ ...pageStyle, ...themeVars }}>
      {isThemed && <LoginDecorations emojis={decorationEmojis} />}

      {/* Desktop header — hidden on mobile */}
      <header className="relative hidden lg:flex px-6 py-4 items-center justify-between">
        <Link to="/" aria-label={t('login.homeLink')} className="flex items-center gap-2 text-bark font-semibold text-lg" style={headingStyle}>
          <KaydoLogo size={22} />
          <span>Kaydo</span>
        </Link>
      </header>

      {/* On a phone the column fills at least one screen and the picture
          absorbs the leftover height. It may shrink to nothing, and the page
          scrolls when the form needs more than the screen: it used to be held
          to exactly one screen, which cut off the bottom of the admin form on
          small phones. */}
      <main className={`relative flex-1 flex flex-col lg:flex-row items-stretch px-5 pt-4 ${isThemed ? 'pb-6' : 'pb-8'} lg:p-0`}>
        {/* Phone brand */}
        <Link to="/" aria-label={t('login.homeLink')} className="lg:hidden flex items-center gap-2 mb-4 self-start">
          <KaydoLogo size={22} />
          <span className="text-lg font-bold text-bark" style={headingStyle}>Kaydo</span>
        </Link>

        {/* Picture: a card on a phone, the left half on a desktop. On a phone
            the standard picture's card is held to its banner's shape, so a
            tall screen does not crop it to a sliver of its middle; the form is
            centred in the space left over. A family's own photo fills the
            space. */}
        <div
          className={`${showPhonePicture ? 'flex' : 'hidden lg:flex'} relative overflow-hidden rounded-2xl flex-1 min-h-0 ${isThemed ? 'mb-4' : 'mb-6'} lg:flex-none lg:w-1/2 lg:mb-0 lg:rounded-none items-start justify-center lg:items-center lg:p-12 ${isThemed ? '' : 'lg:bg-cream-dark'} ${resolvedFamilyHeaderImage ? '' : 'max-lg:max-h-[calc((100vw-2.5rem)*0.513)]'}`}
        >
          {resolvedFamilyHeaderImage
            ? <img src={resolvedFamilyHeaderImage} alt={t('familyImageAlt')} className="absolute inset-0 w-full h-full object-cover object-top" />
            : <LoginArt />}
          {/* The white text sits on a dark gradient, so it stays readable
              whatever the family uploaded. Under the standard picture it is
              the green of the picture's own bottom band, which a wide or short
              screen crops away. */}
          {resolvedFamilyHeaderImage
            ? <div className="hidden lg:block absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/75 via-black/45 to-transparent" />
            : <div className="hidden lg:block absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#0a3e34] via-[#0a3e34]/80 to-transparent" />}
          <div className="hidden lg:block absolute bottom-8 left-8 right-8 text-white">
            <h2 className="text-3xl font-bold mb-2 drop-shadow-lg">
              {t('login.asideTitle')}
            </h2>
            <p className="text-base drop-shadow">
              {t('login.asideBody')}
            </p>
          </div>
        </div>

        {/* Login column */}
        <div className="flex flex-col max-lg:my-auto lg:w-1/2 lg:items-center lg:justify-center lg:px-16">
          <div className={`w-full lg:max-w-md ${columnCardClass}`}>
            {/* Logo mark */}
            <div className="hidden lg:flex justify-center mb-6">
              <KaydoLogo size={52} />
            </div>

            <h1 className="text-3xl lg:text-4xl font-bold text-bark text-center mb-2 max-lg:[color:var(--login-heading,var(--color-bark))]">
              {welcomeHeading}
            </h1>
            <p className={`text-bark-light text-center ${isThemed ? 'mb-4' : 'mb-6'} lg:mb-8 max-lg:[color:var(--login-text,var(--color-bark-light))] max-lg:[opacity:var(--login-text-opacity,1)]`}>
              {welcomeSubtitle}
            </p>

            {!firebaseReady && <SetupBanner />}

            <div className={formCardClass}>
              {needsFamilyLink
                ? <NoFamilyLinkNotice t={t} onAdminLogin={toggleAdminLogin} />
                : <LoginForm {...formProps} />}
            </div>

            {/* Admin toggle — the notice above carries its own */}
            {!needsFamilyLink && (
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={toggleAdminLogin}
                  className={`text-sm text-bark-muted hover:text-kaydo transition-colors ${phoneTextClass}`}
                >
                  {showAdminLogin ? t('login.backToFamily') : t('login.adminLogin')}
                </button>
              </div>
            )}

            {/* Sign up — admin login only */}
            {showAdminLogin && (
              <div className="mt-6 text-center">
                <p className={`text-sm text-bark-light mb-3 ${phoneTextClass}`}>{t('login.noFamilyYet')}</p>
                <button
                  type="button"
                  onClick={() => navigate('/signup')}
                  className="w-full py-3 border-2 border-cream-dark rounded-full text-kaydo font-semibold hover:bg-cream-dark transition-colors"
                >
                  {t('login.createAccount')}
                </button>
              </div>
            )}

            {/* Secure badge */}
            <div className="hidden lg:flex mt-8 items-center justify-center gap-2 text-sm text-bark-muted">
              <Shield className="w-4 h-4" />
              {t('secureBadge')}
            </div>
          </div>
        </div>
      </main>

      <AuthFooter textStyle={textStyle} />
    </div>
  )
}

// In place of the family form on a /login visit that names no family.
function NoFamilyLinkNotice({ t, onAdminLogin }) {
  return (
    <div className="text-center space-y-4">
      <div className="mx-auto w-12 h-12 rounded-full bg-cream-dark flex items-center justify-center text-kaydo">
        <Link2 className="w-6 h-6" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold text-bark">{t('login.noFamilyLink.title')}</h2>
      <p className="text-sm text-bark-light">{t('login.noFamilyLink.body')}</p>
      <button type="button" onClick={onAdminLogin} className="btn-kaydo w-full">
        {t('login.noFamilyLink.adminButton')}
      </button>
    </div>
  )
}

// The native login card shown on custom-designed pages, either always
// visible or opened from the floating "Sign in" pill. Its look follows the
// admin-picked preset (CARD_STYLES); the form itself is always native UI.
function CustomLoginCard({
  t, navigate, formProps, firebaseReady, familyName,
  showAdminLogin, toggleAdminLogin, styleKey, onClose, titleId, autoFocusPassword = false,
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
      <h1 id={titleId} className={`text-2xl font-bold text-center mb-1 ${dark ? 'text-cream' : 'text-bark'}`}>
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
          onClick={toggleAdminLogin}
          className={`text-sm transition-colors ${dark ? 'text-cream/70 hover:text-cream' : 'text-bark-muted hover:text-kaydo'}`}
        >
          {showAdminLogin ? t('login.backToFamily') : t('login.adminLogin')}
        </button>
      </div>

      {showAdminLogin && (
        <div className="mt-4 text-center">
          <button
            type="button"
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

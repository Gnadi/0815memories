import { useState, useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { Head } from 'vite-react-ssg'
import { db } from '../config/firebase'
import { useAuth } from '../context/AuthContext'
import { Link2, Shield, X } from 'lucide-react'
import KaydoLogo from '../components/KaydoLogo'
import LoginArt from '../components/auth/LoginArt'
import { pickLoginArt } from '../components/auth/loginArtFiles'
import LanguageSwitcher from '../components/LanguageSwitcher'
import TextSizeSwitcher from '../components/TextSizeSwitcher'
import LoginForm, { SetupBanner } from '../components/auth/LoginForm'
import CustomLoginCanvas from '../components/CustomLoginCanvas'
import LoginDecorations from '../components/LoginDecorations'
import { themeToStyles, themeDecorationEmojis, themeText } from '../utils/loginTheme'
import { normalizeLoginCard, CARD_STYLES } from '../utils/loginCard'
import { getSubdomainSlug } from '../utils/familySlug'
import { getFamilyPublic, resolveFamilyBySlug } from '../services/family'
import useDialogFocus from '../hooks/useDialogFocus'
import { usePictureRoom } from '../hooks/usePictureRoom'
import AuthFooter from '../components/auth/AuthFooter'
import { safeNextPath } from '../utils/nextPath'
import { readLastFamily, forgetLastFamily } from '../utils/authStorage'

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
  // The standard picture's motif, kept for the visit.
  const [artMotif] = useState(() => pickLoginArt())
  // On a phone the picture gets the height the form leaves over, and steps
  // aside where that is a strip.
  const [observePicture, pictureTooSmall] = usePictureRoom()
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
  // ?family= id as fallback, then the family this device signed in to last.
  // Empty on a plain /login visit from a device that remembers none.
  // On a slug or subdomain page the family is fixed by the address; a
  // ?family= id there would only let a crafted link put another family's
  // design on this family's login page.
  const hasSlug = !!(routeSlug || getSubdomainSlug())
  // Read once, on the first render: storage is not there in the pre-render.
  const [rememberedFamilyId, setRememberedFamilyId] = useState(
    () => (hasSlug || urlFamilyId ? null : readLastFamily()),
  )
  const familyIdParam = urlFamilyId || rememberedFamilyId
  const fromMemory = !hasSlug && !urlFamilyId && !!rememberedFamilyId
  const lookupKey = routeSlug || getSubdomainSlug() || familyIdParam || ''

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

  // Load customization for families accessed via ?family= query param, or
  // remembered by this device (no slug)
  useEffect(() => {
    if (!familyIdParam || resolvedFamilyId || hasSlug) return
    if (!db) {
      setResolving(false)
      return
    }
    getFamilyPublic(familyIdParam)
      .then((data) => {
        if (data) {
          const resolved = toResolvedFamily(data)
          setResolvedFamily(resolved)
          writeCachedFamily(familyIdParam, resolved)
        } else if (fromMemory) {
          // The family is gone. Its login page can no longer be shown, so the
          // device stops offering it.
          forgetLastFamily()
          setRememberedFamilyId(null)
          setResolvedFamily(null)
        }
      })
      .catch(() => {})
      .finally(() => setResolving(false))
  }, [familyIdParam, resolvedFamilyId, hasSlug, fromMemory])

  // The effective familyId: resolved slug takes priority, then query param or
  // remembered family as fallback
  const effectiveFamilyId = resolvedFamilyId || (hasSlug ? null : familyIdParam)

  // "Not your family?" on a family login this device remembered: forget it
  // and ask for a link, as on any other device.
  const forgetFamily = fromMemory
    ? () => {
      forgetLastFamily()
      setRememberedFamilyId(null)
      setResolvedFamily(null)
      setError('')
    }
    : null

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
      t, formProps, firebaseReady,
      familyName: resolvedFamilyName,
      showAdminLogin, toggleAdminLogin, forgetFamily,
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
  // photo; the default illustration clashes with themes.
  const showPhonePicture = !isThemed || resolvedFamilyHeaderImage
  // Below the desktop layout, picture and form keep to a column of a phone's
  // width plus some (36rem): on a tablet they stretched across the screen.
  // A plain /login visit names no family, and a family member's private key
  // means nothing without one. The field used to be shown anyway, and said
  // so only after it was filled in and sent.
  const needsFamilyLink = !showAdminLogin && !lookupKey

  return (
    <div className="relative min-h-dvh bg-cream flex flex-col" style={{ ...pageStyle, ...themeVars }}>
      {isThemed && <LoginDecorations emojis={decorationEmojis} />}

      {/* Once for every screen size, beside the brand of the phone row or
          the desktop header */}
      <div className="absolute z-10 top-3 end-4 lg:top-3.5 lg:end-6">
        <LoginToolbar />
      </div>

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

        {/* Picture: a card on a phone, and on a desktop the left half, as a
            card too — inset from the edges with rounded corners and a soft
            shadow, like a photo laid on the table. Flush against the page, the
            picture's warmer cream met the page's at a hard seam. On a phone
            the standard picture's card is held to its banner's shape, so a
            tall screen does not crop it to a sliver of its middle, and picture
            and form are centred together in the space left over: centring the
            form alone left a gap between the picture and the heading. A
            family's own photo fills the space. */}
        <div
          className={`${showPhonePicture ? 'flex' : 'hidden lg:flex'} relative overflow-hidden rounded-2xl max-lg:w-full max-lg:max-w-xl max-lg:mx-auto max-lg:mt-auto flex-1 min-h-0 ${resolvedFamilyHeaderImage ? '' : 'max-lg:max-h-[calc(min(100vw-2.5rem,36rem)*var(--art-ratio))]'} ${isThemed ? 'mb-4' : 'mb-6'} lg:flex-none lg:w-[calc(50%-1.5rem)] lg:ms-6 lg:mt-2 lg:mb-6 lg:rounded-[28px] lg:shadow-[0_18px_40px_-18px_rgba(60,40,20,0.35)] items-start justify-center lg:items-center lg:p-12 ${isThemed ? '' : 'lg:bg-cream-dark'}`}
          style={{ '--art-ratio': artMotif.mobile.height / artMotif.mobile.width }}
          ref={observePicture}
        >
          {pictureTooSmall
            ? null
            : resolvedFamilyHeaderImage
              ? <img src={resolvedFamilyHeaderImage} alt={t('familyImageAlt')} className="absolute inset-0 w-full h-full object-cover object-top" />
              : <LoginArt motif={artMotif} />}
        </div>

        {/* Login column */}
        <div className="flex flex-col max-lg:mb-auto max-lg:w-full max-lg:max-w-xl max-lg:mx-auto lg:w-1/2 lg:items-center lg:justify-center lg:px-16">
          <div className={`w-full lg:max-w-md ${columnCardClass}`}>
            {/* Logo mark */}
            <div className="hidden lg:flex justify-center mb-6">
              <KaydoLogo size={52} />
            </div>

            <h1 className={`text-3xl lg:text-4xl font-bold text-bark text-center ${showAdminLogin ? 'mb-4 lg:mb-2' : 'mb-2'} max-lg:[color:var(--login-heading,var(--color-bark))]`}>
              {welcomeHeading}
            </h1>
            {/* Not on a phone's admin login: it is for the family coming home,
                and the admin form needs the height to fit the screen. */}
            <p className={`text-bark-light text-center ${isThemed ? 'mb-4' : 'mb-6'} ${showAdminLogin ? 'max-lg:hidden' : ''} lg:mb-8 max-lg:[color:var(--login-text,var(--color-bark-light))] max-lg:[opacity:var(--login-text-opacity,1)]`}>
              {welcomeSubtitle}
            </p>

            {!firebaseReady && <SetupBanner />}

            <div className={formCardClass}>
              {needsFamilyLink
                ? <NoFamilyLinkNotice t={t} onAdminLogin={toggleAdminLogin} />
                : <LoginForm {...formProps} />}
            </div>

            {/* Admin toggle — the notice above carries its own. Back to the
                family login only where there is a family to go back to: from
                the landing page's "Login" it led to the notice asking for a
                link, and cost a phone the line it needed to fit the screen. */}
            {!needsFamilyLink && (!showAdminLogin || lookupKey) && (
              <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1">
                <button
                  type="button"
                  onClick={toggleAdminLogin}
                  className={`text-sm text-bark-muted hover:text-kaydo transition-colors ${phoneTextClass}`}
                >
                  {showAdminLogin ? t('login.backToFamily') : t('login.adminLogin')}
                </button>
                {forgetFamily && !showAdminLogin && (
                  <button
                    type="button"
                    onClick={forgetFamily}
                    className={`text-sm text-bark-muted hover:text-kaydo transition-colors ${phoneTextClass}`}
                  >
                    {t('login.notYourFamily')}
                  </button>
                )}
              </div>
            )}

            {/* Sign up — admin login only. One line with a link: as a second
                full-width button it competed with "Enter the Home" and took
                the height the admin login needs to fit a phone's screen. */}
            {showAdminLogin && (
              <p className={`mt-4 text-center text-sm text-bark-light ${phoneTextClass}`}>
                {t('login.noFamilyYet')}{' '}
                <Link to="/signup" className="font-semibold text-kaydo hover:underline">
                  {t('login.createAccount')}
                </Link>
              </p>
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

// Text size and language, before anyone has signed in. Both are per device
// and were only to be found inside the app, while the people most likely to
// need larger text — grandparents typing a key — met the login page first.
function LoginToolbar() {
  return (
    <div className="flex items-center gap-1">
      <TextSizeSwitcher variant="icon" />
      <LanguageSwitcher />
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
  t, formProps, firebaseReady, familyName,
  showAdminLogin, toggleAdminLogin, forgetFamily, styleKey, onClose, titleId, autoFocusPassword = false,
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

      <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1">
        <button
          type="button"
          onClick={toggleAdminLogin}
          className={`text-sm transition-colors ${dark ? 'text-cream/70 hover:text-cream' : 'text-bark-muted hover:text-kaydo'}`}
        >
          {showAdminLogin ? t('login.backToFamily') : t('login.adminLogin')}
        </button>
        {forgetFamily && !showAdminLogin && (
          <button
            type="button"
            onClick={forgetFamily}
            className={`text-sm transition-colors ${dark ? 'text-cream/70 hover:text-cream' : 'text-bark-muted hover:text-kaydo'}`}
          >
            {t('login.notYourFamily')}
          </button>
        )}
      </div>

      {showAdminLogin && (
        <p className={`mt-4 text-center text-sm ${dark ? 'text-cream/80' : 'text-bark-light'}`}>
          {t('login.noFamilyYet')}{' '}
          <Link to="/signup" className={`font-semibold hover:underline ${dark ? 'text-cream' : 'text-kaydo'}`}>
            {t('login.createAccount')}
          </Link>
        </p>
      )}
    </div>
  )
}

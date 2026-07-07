import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../context/AuthContext'
import { Shield } from 'lucide-react'
import KaydoLogo from '../components/KaydoLogo'
import FamilyIllustration from '../components/FamilyIllustration'
import LoginForm, { SetupBanner } from '../components/auth/LoginForm'
import CustomLoginCanvas from '../components/CustomLoginCanvas'
import LoginDecorations from '../components/LoginDecorations'
import { themeToStyles, themeDecorationEmojis, themeText } from '../utils/loginTheme'
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

  // Family resolution state
  const [resolvedFamilyId, setResolvedFamilyId] = useState(null)
  const [resolvedFamily, setResolvedFamily] = useState(null)
  const [, setResolving] = useState(false)

  const { loginAsViewer, loginAsAdmin, isAuthenticated, firebaseReady } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { slug: routeSlug } = useParams()
  const urlFamilyId = searchParams.get('family')
  const adminParam = searchParams.get('admin')

  useEffect(() => {
    if (adminParam === '1') setShowAdminLogin(true)
  }, [adminParam])

  // Resolve family from slug (route param or subdomain) on mount
  useEffect(() => {
    const slug = routeSlug || getSubdomainSlug()
    if (!slug) return

    setResolving(true)
    resolveFamilyBySlug(slug)
      .then((family) => {
        if (family) {
          setResolvedFamilyId(family.id)
          setResolvedFamily(toResolvedFamily(family))
        } else {
          setError(t('login.errors.familyNotFound'))
        }
      })
      .catch(() => setError(t('login.errors.couldNotLoadFamily')))
      .finally(() => setResolving(false))
  }, [routeSlug, t])

  // Load customization for families accessed via ?family= query param (no slug)
  useEffect(() => {
    if (!urlFamilyId || resolvedFamilyId || !db) return
    getDoc(doc(db, 'families', urlFamilyId))
      .then((snap) => {
        if (snap.exists()) {
          setResolvedFamily(toResolvedFamily(snap.data()))
        }
      })
      .catch(() => {})
  }, [urlFamilyId, resolvedFamilyId])

  // The effective familyId: resolved slug takes priority, then query param fallback
  const effectiveFamilyId = resolvedFamilyId || urlFamilyId

  if (isAuthenticated) {
    navigate('/home', { replace: true })
    return null
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

  const formProps = {
    showAdminLogin, email, setEmail, password, setPassword,
    showPassword, setShowPassword, stayLoggedIn, setStayLoggedIn,
    error, loading, handleSubmit,
  }

  const resolvedFamilyName = resolvedFamily?.name || null
  const resolvedFamilyHeaderImage = resolvedFamily?.headerImage || ''

  // ====== CUSTOM MODE (admin-authored HTML/CSS, sanitized + shadow-DOM) ======
  if (resolvedFamily?.pageMode === 'custom' && resolvedFamily.customHtml) {
    return (
      <div className="relative min-h-screen bg-cream">
        {/* Form overlay first in DOM (keyboard/screen-reader priority), painted on top via z-10 */}
        <div className="fixed inset-0 z-10 overflow-y-auto pointer-events-none flex items-start sm:items-center justify-center p-4">
          <div className="pointer-events-auto w-full max-w-md my-8 bg-warm-white/95 backdrop-blur rounded-2xl shadow-2xl p-6">
            <div className="flex justify-center mb-4">
              <KaydoLogo size={40} />
            </div>
            <h1 className="text-2xl font-bold text-bark text-center mb-1">
              {resolvedFamilyName
                ? t('login.welcomeFamily', { name: resolvedFamilyName })
                : t('login.welcomeHome')}
            </h1>
            <p className="text-bark-light text-center text-sm mb-5">
              {t('login.subtitle')}
            </p>

            {!firebaseReady && <SetupBanner />}

            <LoginForm {...formProps} />

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setShowAdminLogin(!showAdminLogin)}
                className="text-sm text-bark-muted hover:text-kaydo transition-colors"
              >
                {showAdminLogin ? t('login.backToFamily') : t('login.adminLogin')}
              </button>
            </div>

            {showAdminLogin && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => navigate('/signup')}
                  className="w-full py-3 border-2 border-cream-dark rounded-full text-kaydo font-semibold hover:bg-cream-dark transition-colors"
                >
                  {t('login.createAccount')}
                </button>
              </div>
            )}
          </div>
        </div>

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
  const { pageStyle, headingStyle, textStyle } = isThemed
    ? themeToStyles(resolvedFamily.theme)
    : { pageStyle: {}, headingStyle: {}, textStyle: {} }
  const decorationEmojis = isThemed ? themeDecorationEmojis(resolvedFamily.theme) : []
  const welcomeTitleOverride = isThemed ? themeText(resolvedFamily.theme, 'welcomeTitle') : ''
  const welcomeMessageOverride = isThemed ? themeText(resolvedFamily.theme, 'welcomeMessage') : ''

  const welcomeHeading = welcomeTitleOverride
    || (resolvedFamilyName
      ? t('login.welcomeFamily', { name: resolvedFamilyName })
      : t('login.welcomeHome'))
  const welcomeSubtitle = welcomeMessageOverride || t('login.subtitle')

  return (
    <div className="relative min-h-screen bg-cream flex flex-col" style={pageStyle}>
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
        <div className="lg:hidden flex-1 flex flex-col px-5 pt-4 pb-8">
          {/* Mobile brand */}
          <div className="flex items-center gap-2 mb-4">
            <KaydoLogo size={22} />
            <span className="text-lg font-bold text-bark" style={headingStyle}>Kaydo</span>
          </div>

          {/* Illustration card */}
          <div className="rounded-2xl overflow-hidden mb-6 h-48">
            {resolvedFamilyHeaderImage
              ? <img src={resolvedFamilyHeaderImage} alt={t('familyImageAlt')} className="w-full h-full object-cover" />
              : <FamilyIllustration />}
          </div>

          {/* Welcome heading */}
          <h1 className="text-3xl font-bold text-bark text-center mb-2" style={headingStyle}>
            {welcomeHeading}
          </h1>
          <p className="text-bark-light text-center mb-6" style={textStyle}>
            {welcomeSubtitle}
          </p>

          {!firebaseReady && <SetupBanner />}

          {/* Form */}
          {isThemed
            ? (
              <div className="bg-warm-white/90 backdrop-blur rounded-2xl shadow-lg p-5">
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
          <div className={`w-full max-w-md ${isThemed ? 'bg-warm-white/90 backdrop-blur rounded-2xl shadow-lg p-8' : ''}`}>
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

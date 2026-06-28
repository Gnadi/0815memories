import { useState, useEffect } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../context/AuthContext'
import { Mail, KeyRound, Eye, EyeOff, Shield } from 'lucide-react'
import KaydoLogo from '../components/KaydoLogo'
import FamilyIllustration from '../components/FamilyIllustration'
import { resolveFamilyBySlug, getSubdomainSlug } from '../utils/familySlug'

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
  const [resolvedFamilyName, setResolvedFamilyName] = useState(null)
  const [resolvedFamilyHeaderImage, setResolvedFamilyHeaderImage] = useState('')
  const [resolving, setResolving] = useState(false)

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
          setResolvedFamilyName(family.familyName)
          setResolvedFamilyHeaderImage(family.loginHeaderImage || '')
        } else {
          setError(t('login.errors.familyNotFound'))
        }
      })
      .catch(() => setError(t('login.errors.couldNotLoadFamily')))
      .finally(() => setResolving(false))
  }, [routeSlug, t])

  // Load header image for families accessed via ?family= query param (no slug)
  useEffect(() => {
    if (!urlFamilyId || resolvedFamilyId || !db) return
    getDoc(doc(db, 'families', urlFamilyId))
      .then((snap) => {
        if (snap.exists()) {
          setResolvedFamilyHeaderImage(snap.data().loginHeaderImage || '')
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

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Desktop header — hidden on mobile */}
      <header className="hidden lg:flex px-6 py-4 items-center justify-between">
        <div className="flex items-center gap-2 text-bark font-semibold text-lg">
          <KaydoLogo size={22} />
          <span>Kaydo</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col lg:flex-row items-stretch">
        {/* ====== MOBILE LAYOUT (< lg) ====== */}
        <div className="lg:hidden flex-1 flex flex-col px-5 pt-4 pb-8">
          {/* Mobile brand */}
          <div className="flex items-center gap-2 mb-4">
            <KaydoLogo size={22} />
            <span className="text-lg font-bold text-bark">Kaydo</span>
          </div>

          {/* Illustration card */}
          <div className="rounded-2xl overflow-hidden mb-6 h-48">
            {resolvedFamilyHeaderImage
              ? <img src={resolvedFamilyHeaderImage} alt={t('familyImageAlt')} className="w-full h-full object-cover" />
              : <FamilyIllustration />}
          </div>

          {/* Welcome heading */}
          <h1 className="text-3xl font-bold text-bark text-center mb-2">
            {resolvedFamilyName
              ? t('login.welcomeFamily', { name: resolvedFamilyName })
              : t('login.welcomeHome')}
          </h1>
          <p className="text-bark-light text-center mb-6">
            {t('login.subtitle')}
          </p>

          {!firebaseReady && <SetupBanner />}

          {/* Form */}
          <LoginForm
            showAdminLogin={showAdminLogin}
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            stayLoggedIn={stayLoggedIn}
            setStayLoggedIn={setStayLoggedIn}
            error={error}
            loading={loading}
            handleSubmit={handleSubmit}
          />

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
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center bg-cream-dark p-12">
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
          <div className="w-full max-w-md">
            {/* Logo mark */}
            <div className="flex justify-center mb-6">
              <KaydoLogo size={52} />
            </div>

            <h1 className="text-4xl font-bold text-bark text-center mb-2">
              {t('login.welcomeHome')}
            </h1>
            <p className="text-bark-light text-center mb-8">
              {t('login.subtitle')}
            </p>

            {!firebaseReady && <SetupBanner />}

            <LoginForm
              showAdminLogin={showAdminLogin}
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              stayLoggedIn={stayLoggedIn}
              setStayLoggedIn={setStayLoggedIn}
              error={error}
              loading={loading}
              handleSubmit={handleSubmit}
            />

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
      <footer className="hidden lg:flex px-6 py-4 items-center justify-between text-xs text-bark-muted border-t border-cream-dark">
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

function SetupBanner() {
  const { t } = useTranslation('auth')
  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm mb-4">
      <strong>{t('setupBanner.title')}</strong>{' '}
      <Trans
        t={t}
        i18nKey="setupBanner.body"
        components={[
          <code className="bg-amber-100 px-1 rounded" />,
          <code className="bg-amber-100 px-1 rounded" />,
        ]}
      />
    </div>
  )
}

function LoginForm({
  showAdminLogin, email, setEmail, password, setPassword,
  showPassword, setShowPassword, stayLoggedIn, setStayLoggedIn,
  error, loading, handleSubmit,
}) {
  const { t } = useTranslation('auth')
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Admin email field */}
      {showAdminLogin && (
        <div>
          <label className="block text-sm font-medium text-bark mb-1.5">
            {t('login.form.familyEmailLabel')}
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login.form.familyEmailPlaceholder')}
              className="w-full pl-12 pr-4 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-kaydo/30"
            />
          </div>
        </div>
      )}

      {/* Password field */}
      <div>
        <label className="block text-sm font-medium text-bark mb-1.5">
          {t('login.form.privateKeyLabel')}
        </label>
        <div className="relative">
          <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('login.form.privateKeyPlaceholder')}
            className="w-full pl-12 pr-12 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-kaydo/30"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? t('hidePassword') : t('showPassword')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-bark-muted hover:text-bark"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Stay logged in */}
      <div className="flex items-center">
        <label className="flex items-center gap-2 text-sm text-bark-light cursor-pointer">
          <input
            type="checkbox"
            checked={stayLoggedIn}
            onChange={(e) => setStayLoggedIn(e.target.checked)}
            className="w-4 h-4 rounded border-bark-muted accent-kaydo"
          />
          {t('login.form.stayLoggedIn')}
        </label>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg">
          {error}
        </p>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={loading}
        className="btn-kaydo w-full flex items-center justify-center gap-2 text-lg disabled:opacity-60"
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            {t('login.form.submit')}
            <span className="text-xl">&rarr;</span>
          </>
        )}
      </button>
    </form>
  )
}


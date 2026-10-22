import { useState, useMemo, useCallback, useId } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Mail, KeyRound, Eye, EyeOff, User, Shield, Home } from 'lucide-react'
import KaydoLogo from '../components/KaydoLogo'
import FamilyIllustration from '../components/FamilyIllustration'
import VerifyEmailStep from '../components/auth/VerifyEmailStep'
import { generateSlug } from '../utils/familySlug'

/**
 * Signing up is three steps: the account, the confirmation of its email
 * address, then the family. firestore.rules refuses a family to an account
 * whose address is not confirmed (see signup() in AuthContext), so the page
 * picks its step from the session rather than from what was typed here: an
 * account that stopped after the first step, in this tab or long ago, is sent
 * back here by ProtectedRoute and carries on where it stopped.
 */
export default function SignupPage() {
  const { t, i18n } = useTranslation('auth')
  const location = useLocation()
  const [displayName, setDisplayName] = useState('')
  // Handed over by the landing page's "claim your address" form.
  const [familyName, setFamilyName] = useState(() => location.state?.familyName || '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const slugPreview = useMemo(() => generateSlug(familyName), [familyName])

  const {
    signup, createOwnFamily, user, isAuthenticated, isViewer, familyId, emailVerified,
    loading: authLoading, firebaseReady,
  } = useAuth()
  const navigate = useNavigate()

  // Stable, so VerifyEmailStep's polling is not restarted on every render.
  const onVerified = useCallback(() => setError(''), [])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-kaydo border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Done, or nothing to sign up for: a member of a family belongs in it.
  if (isAuthenticated && (familyId || isViewer)) {
    return <Navigate to="/home" replace />
  }

  const step = !user ? 'account' : emailVerified ? 'family' : 'verify'

  const errorMessage = (err, fallback) => {
    const messages = {
      'auth/email-already-in-use': 'signup.errors.emailInUse',
      'auth/invalid-email': 'signup.errors.invalidEmail',
      'auth/weak-password': 'signup.errors.weakPassword',
      'auth/too-many-requests': 'signup.errors.tooManyRequests',
      'email-not-verified': 'signup.errors.notVerified',
    }
    if (messages[err?.code]) return t(messages[err.code])
    if (/already taken/i.test(err?.message || '')) return t('signup.errors.familyNameTaken')
    if (/invalid URL/i.test(err?.message || '')) return t('signup.errors.familyNameInvalid')
    return t(fallback)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError(t('signup.errors.passwordMismatch'))
      return
    }

    if (password.length < 6) {
      setError(t('signup.errors.passwordTooShort'))
      return
    }

    setLoading(true)
    try {
      // Creates the account and sends the confirmation mail; the page moves on
      // to the next step with the session.
      await signup(email, password, displayName, familyName, i18n.resolvedLanguage)
    } catch (err) {
      setError(errorMessage(err, 'signup.errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  const handleCreateFamily = async (e) => {
    e.preventDefault()
    if (loading) return
    setError('')
    setLoading(true)
    try {
      await createOwnFamily(familyName)
      navigate('/home', { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'signup.errors.couldNotCreateFamily'))
    } finally {
      setLoading(false)
    }
  }

  const stepContent = () => {
    if (step === 'verify') return <VerifyEmailStep onVerified={onVerified} />
    if (step === 'family') {
      return (
        <FamilyStep
          familyName={familyName} setFamilyName={setFamilyName} slugPreview={slugPreview}
          error={error} loading={loading} handleSubmit={handleCreateFamily}
        />
      )
    }
    return (
      <SignupForm
        displayName={displayName} setDisplayName={setDisplayName}
        familyName={familyName} setFamilyName={setFamilyName}
        email={email} setEmail={setEmail}
        password={password} setPassword={setPassword}
        confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
        showPassword={showPassword} setShowPassword={setShowPassword}
        showConfirm={showConfirm} setShowConfirm={setShowConfirm}
        error={error} loading={loading} handleSubmit={handleSubmit} slugPreview={slugPreview}
      />
    )
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

      <main className="flex-1 flex flex-col lg:flex-row items-stretch">
        {/* ====== MOBILE LAYOUT (< lg) ====== */}
        <div className="lg:hidden flex-1 flex flex-col px-5 pt-4 pb-8">
          {/* Mobile brand */}
          <div className="flex items-center gap-2 mb-4">
            <KaydoLogo size={22} />
            <span className="text-lg font-bold text-bark">Kaydo</span>
          </div>

          {/* Illustration card */}
          <div className="rounded-2xl overflow-hidden mb-6">
            <FamilyIllustration />
          </div>

          {/* Welcome heading */}
          <h1 className="text-3xl font-bold text-bark text-center mb-2">
            {t('signup.title')}
          </h1>
          <p className="text-bark-light text-center mb-6">
            {t('signup.subtitle')}
          </p>

          {!firebaseReady && <SetupBanner />}

          {stepContent()}

          {/* Sign in link */}
          {step === 'account' && (
            <div className="mt-6 text-center">
              <p className="text-sm text-bark-light">
                {t('signup.alreadyHaveAccount')}{' '}
                <button
                  onClick={() => navigate('/')}
                  className="text-kaydo font-semibold hover:text-kaydo-dark"
                >
                  {t('signup.signIn')}
                </button>
              </p>
            </div>
          )}
        </div>

        {/* ====== DESKTOP LAYOUT (>= lg) ====== */}
        {/* Left — Illustration */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center bg-cream-dark p-12">
          <FamilyIllustration />
          <div className="absolute bottom-8 left-8 right-8 text-white">
            <h2 className="text-3xl font-bold mb-2 drop-shadow-lg">
              {t('signup.asideTitle')}
            </h2>
            <p className="text-base opacity-90 drop-shadow">
              {t('signup.asideBody')}
            </p>
          </div>
        </div>

        {/* Right — Signup Form */}
        <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center px-16">
          <div className="w-full max-w-md">
            {/* Logo mark */}
            <div className="flex justify-center mb-6">
              <KaydoLogo size={52} />
            </div>

            <h1 className="text-4xl font-bold text-bark text-center mb-2">
              {t('signup.title')}
            </h1>
            <p className="text-bark-light text-center mb-8">
              {t('signup.subtitle')}
            </p>

            {!firebaseReady && <SetupBanner />}

            {stepContent()}

            {/* Sign in link */}
            {step === 'account' && (
              <div className="mt-6 text-center">
                <p className="text-sm text-bark-light">
                  {t('signup.alreadyHaveAccount')}{' '}
                  <button
                    onClick={() => navigate('/')}
                    className="text-kaydo font-semibold hover:text-kaydo-dark"
                  >
                    {t('signup.signIn')}
                  </button>
                </p>
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

function SignupForm({
  displayName, setDisplayName, familyName, setFamilyName,
  email, setEmail,
  password, setPassword, confirmPassword, setConfirmPassword,
  showPassword, setShowPassword, showConfirm, setShowConfirm,
  error, loading, handleSubmit, slugPreview,
}) {
  const { t } = useTranslation('auth')
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Display Name */}
      <div>
        <label className="block text-sm font-medium text-bark mb-1.5">
          {t('signup.form.nameLabel')}
        </label>
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('signup.form.namePlaceholder')}
            className="w-full pl-12 pr-4 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-kaydo/30"
            required
          />
        </div>
      </div>

      {/* Family Name */}
      <div>
        <label className="block text-sm font-medium text-bark mb-1.5">
          {t('signup.form.familyNameLabel')}
        </label>
        <div className="relative">
          <Home className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
          <input
            type="text"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            placeholder={t('signup.form.familyNamePlaceholder')}
            className="w-full pl-12 pr-4 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-kaydo/30"
            required
          />
        </div>
        {slugPreview && (
          <p className="text-xs text-bark-muted mt-1.5">
            {t('signup.form.familyUrl')} <span className="font-medium text-kaydo">{window.location.origin}/family/{slugPreview}</span>
          </p>
        )}
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-bark mb-1.5">
          {t('signup.form.emailLabel')}
        </label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('signup.form.emailPlaceholder')}
            className="w-full pl-12 pr-4 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-kaydo/30"
            required
          />
        </div>
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-medium text-bark mb-1.5">
          {t('signup.form.passwordLabel')}
        </label>
        <div className="relative">
          <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('signup.form.passwordPlaceholder')}
            className="w-full pl-12 pr-12 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-kaydo/30"
            required
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? t('hidePassword') : t('showPassword')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-bark-muted hover:text-bark"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Confirm Password */}
      <div>
        <label className="block text-sm font-medium text-bark mb-1.5">
          {t('signup.form.confirmPasswordLabel')}
        </label>
        <div className="relative">
          <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
          <input
            type={showConfirm ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t('signup.form.confirmPasswordPlaceholder')}
            className="w-full pl-12 pr-12 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-kaydo/30"
            required
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            aria-label={showConfirm ? t('hidePassword') : t('showPassword')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-bark-muted hover:text-bark"
          >
            {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
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
            {t('signup.form.submit')}
            <span className="text-xl">&rarr;</span>
          </>
        )}
      </button>
    </form>
  )
}

// The last step: the address is confirmed, the family is founded. Also where an
// account lands that no family lists any more, so it says how to join one.
function FamilyStep({ familyName, setFamilyName, slugPreview, error, loading, handleSubmit }) {
  const { t } = useTranslation('auth')
  // The page renders a mobile and a desktop layout at once.
  const nameId = useId()
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-bark">{t('signup.family.title')}</h2>
        <p className="text-sm text-bark-light mt-2">{t('signup.family.body')}</p>
      </div>

      <div>
        <label htmlFor={nameId} className="block text-sm font-medium text-bark mb-1.5">
          {t('signup.form.familyNameLabel')}
        </label>
        <div className="relative">
          <Home className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
          <input
            id={nameId}
            type="text"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            placeholder={t('signup.form.familyNamePlaceholder')}
            className="w-full pl-12 pr-4 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-kaydo/30"
            required
          />
        </div>
        {slugPreview && (
          <p className="text-xs text-bark-muted mt-1.5">
            {t('signup.form.familyUrl')} <span className="font-medium text-kaydo">{window.location.origin}/family/{slugPreview}</span>
          </p>
        )}
      </div>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-kaydo w-full flex items-center justify-center gap-2 text-lg disabled:opacity-60"
      >
        {loading
          ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : t('signup.family.submit')}
      </button>

      <p className="text-xs text-bark-muted text-center">{t('signup.family.invited')}</p>
    </form>
  )
}

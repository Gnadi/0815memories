import { useState, useMemo, useCallback, useId } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Mail, KeyRound, Eye, EyeOff, User, Home } from 'lucide-react'
import AuthPageLayout from '../components/auth/AuthPageLayout'
import VerifyEmailStep from '../components/auth/VerifyEmailStep'
import { generateSlug } from '../utils/familySlug'
import { MIN_PASSWORD_LENGTH } from '../utils/passwordPolicy'
import { loadSkyDraft } from '../utils/sky/skyDraft'

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
  const [showPassword, setShowPassword] = useState(false)
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

  // Done, or nothing to sign up for: a member of a family belongs in it. An
  // admin with a birth sky made before signing up (PublicBirthSkyPage) goes
  // on to it first. This is also where a newly founded family leaves: the
  // session has its family before handleCreateFamily's navigate() runs.
  if (isAuthenticated && (familyId || isViewer)) {
    return <Navigate to={!isViewer && loadSkyDraft() ? '/birth-sky/continue' : '/home'} replace />
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
    if (messages[err?.code]) return t(messages[err.code], { min: MIN_PASSWORD_LENGTH })
    if (/already taken/i.test(err?.message || '')) return t('signup.errors.familyNameTaken')
    if (/invalid URL/i.test(err?.message || '')) return t('signup.errors.familyNameInvalid')
    return t(fallback)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('signup.errors.passwordTooShort', { min: MIN_PASSWORD_LENGTH }))
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
      // A birth sky made before signing up is taken over first (see above).
      navigate(loadSkyDraft() ? '/birth-sky/continue' : '/home', { replace: true })
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
        showPassword={showPassword} setShowPassword={setShowPassword}
        error={error} loading={loading} handleSubmit={handleSubmit} slugPreview={slugPreview}
      />
    )
  }

  return (
    <AuthPageLayout title={t('signup.title')} subtitle={t('signup.subtitle')} badge={t('secureBadge')} footer>
      {!firebaseReady && <SetupBanner />}

      {stepContent()}

      {/* Sign in — an account here is an admin's, so the admin login. It
          went to "/", the landing page. */}
      {step === 'account' && (
        <p className="mt-6 text-center text-sm text-bark-light">
          {t('signup.alreadyHaveAccount')}{' '}
          <Link to="/login?admin=1" className="text-kaydo font-semibold hover:text-kaydo-dark">
            {t('signup.signIn')}
          </Link>
        </p>
      )}
    </AuthPageLayout>
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
  password, setPassword,
  showPassword, setShowPassword,
  error, loading, handleSubmit, slugPreview,
}) {
  const { t } = useTranslation('auth')
  const id = useId()
  const ids = {
    name: `${id}-name`, family: `${id}-family`, email: `${id}-email`,
    password: `${id}-password`, error: `${id}-error`,
  }
  const invalidProps = error ? { 'aria-invalid': true, 'aria-describedby': ids.error } : {}
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Display Name */}
      <div>
        <label htmlFor={ids.name} className="block text-sm font-medium text-bark mb-1.5">
          {t('signup.form.nameLabel')}
        </label>
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
          <input
            id={ids.name}
            name="name"
            autoComplete="name"
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
        <label htmlFor={ids.family} className="block text-sm font-medium text-bark mb-1.5">
          {t('signup.form.familyNameLabel')}
        </label>
        <div className="relative">
          <Home className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
          <input
            id={ids.family}
            name="familyName"
            autoComplete="off"
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
            {t('signup.form.familyUrl')} <span dir="ltr" className="font-medium text-kaydo">{window.location.origin}/family/{slugPreview}</span>
          </p>
        )}
      </div>

      {/* Email */}
      <div>
        <label htmlFor={ids.email} className="block text-sm font-medium text-bark mb-1.5">
          {t('signup.form.emailLabel')}
        </label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
          <input
            id={ids.email}
            name="email"
            autoComplete="email"
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
        <label htmlFor={ids.password} className="block text-sm font-medium text-bark mb-1.5">
          {t('signup.form.passwordLabel')}
        </label>
        <div className="relative">
          <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
          {/* One field with its eye, no second one to repeat it: that made
              the form longer than a phone's screen, and a typo is undone by
              the password reset the confirmed address allows. */}
          <input
            id={ids.password}
            name="new-password"
            autoComplete="new-password"
            {...invalidProps}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('signup.form.passwordPlaceholder', { min: MIN_PASSWORD_LENGTH })}
            className="w-full pl-12 pr-12 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-kaydo/30"
            required
            minLength={MIN_PASSWORD_LENGTH}
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


      {/* Error message */}
      {error && (
        <p id={ids.error} role="alert" className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg">
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
            <span className="text-xl inline-block rtl:-scale-x-100" aria-hidden="true">&rarr;</span>
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
            {t('signup.form.familyUrl')} <span dir="ltr" className="font-medium text-kaydo">{window.location.origin}/family/{slugPreview}</span>
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg">
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

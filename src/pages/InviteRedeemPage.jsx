import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../config/firebase'
import { useAuth } from '../context/AuthContext'
import { getFamilyPublic } from '../services/family'
import { getInvite, redeemInvite } from '../services/invites'
import { Mail, KeyRound, Eye, EyeOff, User, Shield, Loader2 } from 'lucide-react'
import KaydoLogo from '../components/KaydoLogo'
import FamilyIllustration from '../components/FamilyIllustration'
import VerifyEmailStep from '../components/auth/VerifyEmailStep'

export default function InviteRedeemPage() {
  const { t, i18n } = useTranslation('auth')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const {
    user, familyId: sessionFamilyId, isViewer, emailVerified, firebaseReady,
    signup, checkEmailVerified, setActiveFamilyId,
  } = useAuth()

  const familyId = searchParams.get('family')
  const token = searchParams.get('token')

  const [validating, setValidating] = useState(true)
  const [inviteValid, setInviteValid] = useState(false)
  const [familyName, setFamilyName] = useState('')
  const [validationError, setValidationError] = useState('')

  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!firebaseReady) {
      setValidating(false)
      return
    }
    if (!familyId || !token) {
      setValidating(false)
      setValidationError(t('invite.errors.incompleteLink'))
      return
    }
    let cancelled = false
    async function validate() {
      try {
        // familyPublic, not families: the invitee has no account yet, so this
        // read happens without a token.
        const family = await getFamilyPublic(familyId)
        if (cancelled) return
        if (!family) {
          setValidationError(t('invite.errors.familyNotFound'))
          return
        }
        setFamilyName(family.familyName || t('invite.fallbackFamilyName'))

        const data = await getInvite(familyId, token)
        if (cancelled) return
        if (!data) {
          setValidationError(t('invite.errors.invalidOrRevoked'))
          return
        }
        if (data.used) {
          setValidationError(t('invite.errors.alreadyUsed'))
          return
        }
        const expiresAt = data.expiresAt?.toMillis?.() ?? 0
        if (expiresAt && expiresAt < Date.now()) {
          setValidationError(t('invite.errors.expired'))
          return
        }
        setInviteValid(true)
      } catch (err) {
        if (import.meta.env.DEV) console.error('Invite validation failed', err)
        if (!cancelled) setValidationError(t('invite.errors.validationFailed'))
      } finally {
        if (!cancelled) setValidating(false)
      }
    }
    validate()
    return () => { cancelled = true }
  }, [familyId, token, firebaseReady, t])

  // Joining is three steps: the account, the confirmation of its email
  // address, then the redemption. firestore.rules refuses the redemption to an
  // account whose address is not confirmed — a password reset goes to that
  // address, so an unconfirmed one would hand this family to whoever reads its
  // mail. An account that belongs to no family yet (one that stopped after the
  // first step, here or on /signup) carries on where it stopped; an account
  // that already belongs to a family is asked to sign out, so each admin
  // account stays bound to one family.
  const unfinished = !!user && !sessionFamilyId && !isViewer
  const step = !user ? 'account' : !unfinished ? 'signedIn' : emailVerified ? 'join' : 'verify'

  // Stable, so VerifyEmailStep's polling is not restarted on every render.
  const onVerified = useCallback(() => setError(''), [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (user) {
      setError(t('invite.errors.alreadySignedIn'))
      return
    }
    if (password !== confirmPassword) {
      setError(t('invite.errors.passwordMismatch'))
      return
    }
    if (password.length < 6) {
      setError(t('invite.errors.passwordTooShort'))
      return
    }

    setLoading(true)
    try {
      // Creates the account and sends the confirmation mail. Email uniqueness
      // is enforced by Firebase, which is also our "one UID per family" guard.
      await signup(email, password, displayName, undefined, i18n.resolvedLanguage)
    } catch (err) {
      if (import.meta.env.DEV) console.error('Invite account creation failed', err)
      const messages = {
        'auth/email-already-in-use': 'invite.errors.emailInUse',
        'auth/invalid-email': 'invite.errors.invalidEmail',
        'auth/weak-password': 'invite.errors.weakPassword',
      }
      setError(t(messages[err.code] || 'invite.errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (loading || !user) return
    setError('')
    setLoading(true)
    try {
      // Also fetches the fresh ID token the rules read `email_verified` from.
      if (!(await checkEmailVerified())) {
        setError(t('invite.errors.notVerified'))
        return
      }
      // Redeem the invite in one batch — see services/invites.js.
      await redeemInvite(familyId, token, { uid: user.uid, email: (user.email || '').trim().toLowerCase() })

      // Bind the session to this family explicitly. The onAuthStateChanged
      // handler ran before adminUids included us, so its resolveFamilyId()
      // lookup found nothing and left familyId null — which would land us on
      // /signup until a manual re-login.
      setActiveFamilyId(familyId)

      navigate('/home', { replace: true })
    } catch (err) {
      if (import.meta.env.DEV) console.error('Invite redemption failed', err)
      // The account stays: it belongs to no family, so it can still found one
      // on /signup or join with a fresh invite.
      const messages = {
        // The rules refused the redemption batch: the invite was used, revoked
        // or expired after this page checked it.
        'permission-denied': 'invite.errors.invalidOrRevoked',
      }
      setError(t(messages[err.code] || 'invite.errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  const stepContent = () => {
    if (step === 'verify') return <VerifyEmailStep onVerified={onVerified} />
    if (step === 'join') {
      return <JoinStep familyName={familyName} error={error} loading={loading} onJoin={handleJoin} />
    }
    return (
      <>
        {step === 'signedIn' && !loading && <AlreadySignedInBanner />}
        <RedeemForm
          displayName={displayName} setDisplayName={setDisplayName}
          email={email} setEmail={setEmail}
          password={password} setPassword={setPassword}
          confirmPassword={confirmPassword} setConfirmPassword={setConfirmPassword}
          showPassword={showPassword} setShowPassword={setShowPassword}
          showConfirm={showConfirm} setShowConfirm={setShowConfirm}
          error={error} loading={loading} handleSubmit={handleSubmit}
          disabled={!!user}
        />
      </>
    )
  }

  if (validating) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="flex items-center gap-2 text-bark-light">
          <Loader2 className="w-5 h-5 animate-spin" /> {t('invite.validating')}
        </div>
      </div>
    )
  }

  if (!inviteValid) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-5">
        <div className="max-w-md w-full bg-warm-white rounded-2xl p-6 shadow-sm text-center">
          <KaydoLogo size={40} />
          <h1 className="text-2xl font-bold text-bark mt-4 mb-2">{t('invite.unavailableTitle')}</h1>
          <p className="text-bark-light mb-6">{validationError || t('invite.unavailableBody')}</p>
          <button onClick={() => navigate('/login')} className="btn-kaydo">
            {t('invite.goToSignIn')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <header className="hidden lg:flex px-6 py-4 items-center justify-between">
        <div className="flex items-center gap-2 text-bark font-semibold text-lg">
          <KaydoLogo size={22} />
          <span>Kaydo</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row items-stretch">
        <div className="lg:hidden flex-1 flex flex-col px-5 pt-4 pb-8">
          <div className="flex items-center gap-2 mb-4">
            <KaydoLogo size={22} />
            <span className="text-lg font-bold text-bark">Kaydo</span>
          </div>
          <div className="rounded-2xl overflow-hidden mb-6">
            <FamilyIllustration />
          </div>
          <h1 className="text-3xl font-bold text-bark text-center mb-2">
            {t('invite.joinFamily', { name: familyName })}
          </h1>
          <p className="text-bark-light text-center mb-6">
            {t('invite.subtitle')}
          </p>
          {stepContent()}
        </div>

        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center bg-cream-dark p-12">
          <FamilyIllustration />
          <div className="absolute bottom-8 left-8 right-8 text-white">
            <h2 className="text-3xl font-bold mb-2 drop-shadow-lg">
              {t('invite.asideTitle')}
            </h2>
            <p className="text-base opacity-90 drop-shadow">
              {t('invite.asideBody')}
            </p>
          </div>
        </div>

        <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center px-16">
          <div className="w-full max-w-md">
            <div className="flex justify-center mb-6">
              <KaydoLogo size={52} />
            </div>
            <h1 className="text-4xl font-bold text-bark text-center mb-2">
              Join {familyName}
            </h1>
            <p className="text-bark-light text-center mb-8">
              Create your account to become an admin of this family.
            </p>
            {stepContent()}
            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-bark-muted">
              <Shield className="w-4 h-4" />
              Your account is bound to this family only.
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function AlreadySignedInBanner() {
  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm mb-4">
      You're already signed in. To redeem this invite as a fresh admin, please{' '}
      <button
        type="button"
        className="underline font-semibold"
        onClick={async () => { try { await signOut(auth) } catch { /* noop */ } window.location.reload() }}
      >
        sign out first
      </button>.
    </div>
  )
}

function RedeemForm({
  displayName, setDisplayName,
  email, setEmail,
  password, setPassword, confirmPassword, setConfirmPassword,
  showPassword, setShowPassword, showConfirm, setShowConfirm,
  error, loading, handleSubmit, disabled,
}) {
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-bark mb-1.5">Your Name</label>
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g., Sarah Miller"
            className="w-full pl-12 pr-4 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-kaydo/30"
            required
            disabled={disabled}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-bark mb-1.5">Email</label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full pl-12 pr-4 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-kaydo/30"
            required
            disabled={disabled}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-bark mb-1.5">Password</label>
        <div className="relative">
          <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="w-full pl-12 pr-12 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-kaydo/30"
            required
            minLength={6}
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-bark-muted hover:text-bark"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-bark mb-1.5">Confirm Password</label>
        <div className="relative">
          <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
          <input
            type={showConfirm ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat your password"
            className="w-full pl-12 pr-12 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-kaydo/30"
            required
            minLength={6}
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-bark-muted hover:text-bark"
          >
            {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || disabled}
        className="btn-kaydo w-full flex items-center justify-center gap-2 text-lg disabled:opacity-60"
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            Join family
            <span className="text-xl">&rarr;</span>
          </>
        )}
      </button>
    </form>
  )
}

// The last step: the address is confirmed, and joining is one tap.
function JoinStep({ familyName, error, loading, onJoin }) {
  const { t } = useTranslation('auth')
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-bark">{t('invite.join.title')}</h2>
        <p className="text-sm text-bark-light mt-2">{t('invite.join.body', { name: familyName })}</p>
      </div>
      {error && (
        <p className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg">{error}</p>
      )}
      <button
        type="button"
        onClick={onJoin}
        disabled={loading}
        className="btn-kaydo w-full flex items-center justify-center gap-2 text-lg disabled:opacity-60"
      >
        {loading
          ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : t('invite.join.submit', { name: familyName })}
      </button>
    </div>
  )
}

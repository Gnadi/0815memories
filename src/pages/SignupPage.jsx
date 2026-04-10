import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Mail, KeyRound, Eye, EyeOff, User, Shield, Home } from 'lucide-react'
import KaydoLogo from '../components/KaydoLogo'
import FamilyIllustration from '../components/FamilyIllustration'
import { generateSlug } from '../utils/familySlug'

export default function SignupPage() {
  const [displayName, setDisplayName] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const slugPreview = useMemo(() => generateSlug(familyName), [familyName])

  const { signup, isAuthenticated, firebaseReady } = useAuth()
  const navigate = useNavigate()

  if (isAuthenticated) {
    navigate('/home', { replace: true })
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      await signup(email, password, displayName, familyName)
      navigate('/home')
    } catch (err) {
      const messages = {
        'auth/email-already-in-use': 'An account with this email already exists',
        'auth/invalid-email': 'Please enter a valid email address',
        'auth/weak-password': 'Password must be at least 6 characters',
      }
      setError(messages[err.code] || err.message || 'Could not create account')
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
            Join the Family
          </h1>
          <p className="text-bark-light text-center mb-6">
            Create your Kaydo account.
          </p>

          {!firebaseReady && <SetupBanner />}

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

          {/* Sign in link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-bark-light">
              Already have an account?{' '}
              <button
                onClick={() => navigate('/')}
                className="text-kaydo font-semibold hover:text-kaydo-dark"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>

        {/* ====== DESKTOP LAYOUT (>= lg) ====== */}
        {/* Left — Illustration */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center bg-cream-dark p-12">
          <FamilyIllustration />
          <div className="absolute bottom-8 left-8 right-8 text-white">
            <h2 className="text-3xl font-bold mb-2 drop-shadow-lg">
              Your digital living room awaits.
            </h2>
            <p className="text-base opacity-90 drop-shadow">
              Safe, private, and filled with the ones who matter most.
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
              Join the Family
            </h1>
            <p className="text-bark-light text-center mb-8">
              Create your Kaydo account.
            </p>

            {!firebaseReady && <SetupBanner />}

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

            {/* Sign in link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-bark-light">
                Already have an account?{' '}
                <button
                  onClick={() => navigate('/')}
                  className="text-kaydo font-semibold hover:text-kaydo-dark"
                >
                  Sign in
                </button>
              </p>
            </div>

            {/* Secure badge */}
            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-bark-muted">
              <Shield className="w-4 h-4" />
              Encrypted & Private Family Network
            </div>
          </div>
        </div>
      </main>

      {/* Footer — desktop only */}
      <footer className="hidden lg:flex px-6 py-4 items-center justify-between text-xs text-bark-muted border-t border-cream-dark">
        <p>&copy; {new Date().getFullYear()} Kaydo. Designed for memories.</p>
        <div className="flex gap-4">
          <span className="hover:text-bark cursor-pointer">Privacy Policy</span>
          <span className="hover:text-bark cursor-pointer">Terms of Service</span>
          <span className="hover:text-bark cursor-pointer">Help Center</span>
        </div>
      </footer>
    </div>
  )
}

function SetupBanner() {
  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm mb-4">
      <strong>Setup required:</strong> Firebase environment variables are not configured.
      Copy <code className="bg-amber-100 px-1 rounded">.env.example</code> to{' '}
      <code className="bg-amber-100 px-1 rounded">.env.local</code> and add your Firebase credentials.
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
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Display Name */}
      <div>
        <label className="block text-sm font-medium text-bark mb-1.5">
          Your Name
        </label>
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g., Sarah Miller"
            className="w-full pl-12 pr-4 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-kaydo/30"
            required
          />
        </div>
      </div>

      {/* Family Name */}
      <div>
        <label className="block text-sm font-medium text-bark mb-1.5">
          Family Name
        </label>
        <div className="relative">
          <Home className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
          <input
            type="text"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            placeholder="e.g., The Millers"
            className="w-full pl-12 pr-4 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-kaydo/30"
            required
          />
        </div>
        {slugPreview && (
          <p className="text-xs text-bark-muted mt-1.5">
            Your family URL: <span className="font-medium text-kaydo">{window.location.origin}/family/{slugPreview}</span>
          </p>
        )}
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-bark mb-1.5">
          Email
        </label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="the.millers@kaydo.com"
            className="w-full pl-12 pr-4 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-kaydo/30"
            required
          />
        </div>
      </div>

      {/* Password */}
      <div>
        <label className="block text-sm font-medium text-bark mb-1.5">
          Password
        </label>
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
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-bark-muted hover:text-bark"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Confirm Password */}
      <div>
        <label className="block text-sm font-medium text-bark mb-1.5">
          Confirm Password
        </label>
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
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-bark-muted hover:text-bark"
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
            Create Account
            <span className="text-xl">&rarr;</span>
          </>
        )}
      </button>
    </form>
  )
}

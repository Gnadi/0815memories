import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Home, Mail, KeyRound, Eye, EyeOff, Shield } from 'lucide-react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [stayLoggedIn, setStayLoggedIn] = useState(false)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { loginAsViewer, loginAsAdmin, isAuthenticated } = useAuth()
  const navigate = useNavigate()

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
        await loginAsViewer(password)
      }
      if (!stayLoggedIn) {
        sessionStorage.setItem('fh_session', 'true')
      }
      navigate('/home')
    } catch (err) {
      setError(
        err.code === 'auth/invalid-credential'
          ? 'Invalid email or password'
          : err.message || 'Could not sign in'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-hearth font-semibold text-lg">
          <Home className="w-5 h-5" />
          <span>FamilyHearth</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col lg:flex-row items-stretch">
        {/* Left / Top — Illustration */}
        <div className="lg:w-1/2 relative overflow-hidden flex items-center justify-center bg-cream-dark p-8 lg:p-12">
          <FamilyIllustration />
          <div className="absolute bottom-8 left-8 right-8 text-white">
            <h2 className="text-2xl lg:text-3xl font-bold mb-2 drop-shadow-lg">
              Your digital living room awaits.
            </h2>
            <p className="text-sm lg:text-base opacity-90 drop-shadow">
              Safe, private, and filled with the ones who matter most.
            </p>
          </div>
        </div>

        {/* Right / Bottom — Login Form */}
        <div className="lg:w-1/2 flex flex-col items-center justify-center px-6 py-12 lg:px-16">
          <div className="w-full max-w-md">
            {/* House icon */}
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center">
                <Home className="w-7 h-7 text-hearth" />
              </div>
            </div>

            <h1 className="text-3xl lg:text-4xl font-bold text-bark text-center mb-2">
              Welcome Home
            </h1>
            <p className="text-bark-light text-center mb-8">
              Step inside the digital living room of your loved ones.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Admin email field */}
              {showAdminLogin && (
                <div>
                  <label className="block text-sm font-medium text-bark mb-1.5">
                    Family Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@example.com"
                      className="w-full pl-12 pr-4 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-hearth/30"
                    />
                  </div>
                </div>
              )}

              {/* Password field */}
              <div>
                <label className="block text-sm font-medium text-bark mb-1.5">
                  Private Key
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your private key"
                    className="w-full pl-12 pr-12 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-hearth/30"
                    required
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

              {/* Stay logged in & Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-bark-light cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stayLoggedIn}
                    onChange={(e) => setStayLoggedIn(e.target.checked)}
                    className="w-4 h-4 rounded border-bark-muted accent-hearth"
                  />
                  Stay logged in
                </label>
                <button
                  type="button"
                  className="text-sm text-hearth hover:text-hearth-dark font-medium"
                >
                  Lost your key?
                </button>
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
                className="btn-hearth w-full flex items-center justify-center gap-2 text-lg disabled:opacity-60"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Enter the Home
                    <span className="text-xl">&rarr;</span>
                  </>
                )}
              </button>
            </form>

            {/* Admin toggle */}
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setShowAdminLogin(!showAdminLogin)}
                className="text-sm text-bark-muted hover:text-hearth transition-colors"
              >
                {showAdminLogin ? 'Back to family login' : 'Admin login'}
              </button>
            </div>

            {/* Request invite */}
            <div className="mt-6 text-center">
              <p className="text-sm text-bark-light mb-3">New to the family?</p>
              <button className="w-full py-3 border-2 border-cream-dark rounded-full text-hearth font-semibold hover:bg-cream-dark transition-colors">
                Request an Invite
              </button>
            </div>

            {/* Secure badge */}
            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-bark-muted">
              <Shield className="w-4 h-4" />
              Encrypted & Private Family Network
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-bark-muted border-t border-cream-dark">
        <p>&copy; {new Date().getFullYear()} FamilyHearth. Designed for memories.</p>
        <div className="flex gap-4 mt-2 sm:mt-0">
          <span className="hover:text-bark cursor-pointer">Privacy Policy</span>
          <span className="hover:text-bark cursor-pointer">Terms of Service</span>
          <span className="hover:text-bark cursor-pointer">Help Center</span>
        </div>
      </footer>
    </div>
  )
}

function FamilyIllustration() {
  return (
    <svg viewBox="0 0 500 400" className="w-full max-w-lg" role="img" aria-label="Family gathering illustration">
      {/* Warm background */}
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F4A460" />
          <stop offset="60%" stopColor="#DEB887" />
          <stop offset="100%" stopColor="#D2B48C" />
        </linearGradient>
        <linearGradient id="tableGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8B5E3C" />
          <stop offset="100%" stopColor="#6B3F1F" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="500" height="400" rx="16" fill="url(#skyGrad)" />

      {/* Window glow */}
      <rect x="150" y="30" width="200" height="150" rx="8" fill="#FFD700" opacity="0.3" />
      <rect x="160" y="40" width="80" height="60" rx="4" fill="#FFA500" opacity="0.4" />
      <rect x="260" y="40" width="80" height="60" rx="4" fill="#FFA500" opacity="0.4" />

      {/* Table */}
      <ellipse cx="250" cy="300" rx="200" ry="40" fill="url(#tableGrad)" />

      {/* Plates */}
      <ellipse cx="150" cy="290" rx="25" ry="8" fill="#FFFDF9" opacity="0.8" />
      <ellipse cx="250" cy="285" rx="25" ry="8" fill="#FFFDF9" opacity="0.8" />
      <ellipse cx="350" cy="290" rx="25" ry="8" fill="#FFFDF9" opacity="0.8" />

      {/* People silhouettes - simplified warm figures */}
      {/* Person 1 - left */}
      <circle cx="120" cy="210" r="22" fill="#D2691E" />
      <ellipse cx="120" cy="260" rx="25" ry="35" fill="#CD853F" />

      {/* Person 2 - left center */}
      <circle cx="200" cy="200" r="24" fill="#8B4513" />
      <ellipse cx="200" cy="252" rx="27" ry="38" fill="#A0522D" />

      {/* Person 3 - center (child) */}
      <circle cx="250" cy="225" r="18" fill="#DEB887" />
      <ellipse cx="250" cy="265" rx="18" ry="28" fill="#D2B48C" />

      {/* Person 4 - right center */}
      <circle cx="300" cy="200" r="24" fill="#CD853F" />
      <ellipse cx="300" cy="252" rx="27" ry="38" fill="#8B4513" />

      {/* Person 5 - right */}
      <circle cx="380" cy="210" r="22" fill="#A0522D" />
      <ellipse cx="380" cy="260" rx="25" ry="35" fill="#D2691E" />

      {/* String lights */}
      <path d="M50,120 Q150,90 250,120 Q350,90 450,120" fill="none" stroke="#FFD700" strokeWidth="2" />
      <circle cx="100" cy="112" r="5" fill="#FFD700" opacity="0.8" />
      <circle cx="150" cy="105" r="5" fill="#FF8C00" opacity="0.8" />
      <circle cx="200" cy="112" r="5" fill="#FFD700" opacity="0.8" />
      <circle cx="250" cy="118" r="5" fill="#FF8C00" opacity="0.8" />
      <circle cx="300" cy="112" r="5" fill="#FFD700" opacity="0.8" />
      <circle cx="350" cy="105" r="5" fill="#FF8C00" opacity="0.8" />
      <circle cx="400" cy="112" r="5" fill="#FFD700" opacity="0.8" />

      {/* Warm glow overlay */}
      <rect width="500" height="400" rx="16" fill="#FFA500" opacity="0.08" />
    </svg>
  )
}

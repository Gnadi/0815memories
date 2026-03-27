import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const FAMILY_ILLUSTRATION =
  'https://images.unsplash.com/photo-1609220136736-443140cffec6?w=800&q=80'

export default function Login() {
  const { loginInnerCircle, loginAdmin } = useAuth()
  const [mode, setMode] = useState('inner') // 'inner' | 'admin'
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [stayLoggedIn, setStayLoggedIn] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'inner') {
        await loginInnerCircle(password)
      } else {
        await loginAdmin(email, adminPassword)
      }
    } catch (err) {
      setError(err.message ?? 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-hearth-bg flex flex-col md:flex-row">
      {/* Left panel — illustration (desktop only) */}
      <div className="hidden md:flex md:w-[45%] relative overflow-hidden">
        <img
          src={FAMILY_ILLUSTRATION}
          alt="Family gathering"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="relative z-10 flex flex-col justify-end p-10 pb-14">
          <h2 className="text-white text-3xl font-bold leading-tight">
            Your digital living room awaits.
          </h2>
          <p className="text-white/80 mt-2 text-base">
            Safe, private, and filled with the ones who matter most.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-start md:justify-center overflow-y-auto">
        {/* Mobile hero */}
        <div className="md:hidden w-full h-52 relative overflow-hidden">
          <img
            src={FAMILY_ILLUSTRATION}
            alt="Family gathering"
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-hearth-bg" />
        </div>

        <div className="w-full max-w-sm px-6 py-8 md:py-0">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-[#F5BE45] rounded-full flex items-center justify-center mb-4 shadow-md">
              <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-hearth-text">Welcome Home</h1>
            <p className="text-hearth-muted text-sm mt-1 text-center">
              {mode === 'inner'
                ? 'Step inside the digital living room of your loved ones.'
                : 'Admin access — sign in with your credentials.'}
            </p>
          </div>

          {/* Mode toggle */}
          <div className="flex bg-[#EDE8DF] rounded-full p-1 mb-6">
            <button
              onClick={() => { setMode('inner'); setError('') }}
              className={`flex-1 py-2 text-sm font-semibold rounded-full transition-all duration-150 ${
                mode === 'inner' ? 'bg-white text-hearth-text shadow-sm' : 'text-hearth-muted'
              }`}
            >
              Family Access
            </button>
            <button
              onClick={() => { setMode('admin'); setError('') }}
              className={`flex-1 py-2 text-sm font-semibold rounded-full transition-all duration-150 ${
                mode === 'admin' ? 'bg-white text-hearth-text shadow-sm' : 'text-hearth-muted'
              }`}
            >
              Admin
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'admin' && (
              <div>
                <label className="block text-sm font-semibold text-hearth-text mb-1.5">
                  Family Email
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-hearth-muted">
                    <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="admin@family.com"
                    required
                    className="input-field pl-10"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-hearth-text mb-1.5">
                {mode === 'inner' ? 'Family Key' : 'Private Key'}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-hearth-muted">
                  {mode === 'inner' ? (
                    <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                      <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={mode === 'inner' ? password : adminPassword}
                  onChange={e =>
                    mode === 'inner' ? setPassword(e.target.value) : setAdminPassword(e.target.value)
                  }
                  placeholder="········"
                  required
                  className="input-field pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-hearth-muted hover:text-hearth-text"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                      <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => setStayLoggedIn(p => !p)}
                  className={`w-9 h-5 rounded-full transition-colors duration-200 flex items-center px-0.5 cursor-pointer ${
                    stayLoggedIn ? 'bg-terra' : 'bg-[#D0C8BE]'
                  }`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                    stayLoggedIn ? 'translate-x-4' : 'translate-x-0'
                  }`} />
                </div>
                <span className="text-sm text-hearth-muted">Stay logged in</span>
              </label>
              <button type="button" className="text-sm text-terra font-medium hover:text-terra-dark">
                {mode === 'inner' ? 'Lost your key?' : 'Forgot key?'}
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Entering…
                </>
              ) : (
                <>
                  Enter the Home
                  <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
                    <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {mode === 'inner' && (
            <div className="mt-4">
              <button
                onClick={() => setMode('admin')}
                className="btn-secondary w-full"
              >
                Request an Invite
              </button>
            </div>
          )}

          <p className="mt-6 text-center text-xs text-hearth-muted flex items-center justify-center gap-1.5">
            <svg viewBox="0 0 16 16" className="w-3 h-3 fill-current">
              <path fillRule="evenodd" d="M8 0a8 8 0 100 16A8 8 0 008 0zm.93 6.588l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM8 5.5a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            Encrypted & Private Family Network
          </p>
        </div>

        {/* Desktop footer */}
        <div className="hidden md:flex w-full max-w-sm justify-between text-xs text-hearth-muted py-6 px-6">
          <span>© 2024 FamilyHearth. Designed for memories.</span>
          <div className="flex gap-4">
            <a href="#" className="hover:text-terra">Privacy</a>
            <a href="#" className="hover:text-terra">Terms</a>
            <a href="#" className="hover:text-terra">Help</a>
          </div>
        </div>
      </div>
    </div>
  )
}

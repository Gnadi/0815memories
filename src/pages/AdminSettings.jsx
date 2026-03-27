import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AdminSettings() {
  const { getAdminToken, logout } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  const [appName, setAppName] = useState('')
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [settingsSuccess, setSettingsSuccess] = useState(false)

  async function handlePasswordChange(e) {
    e.preventDefault()
    if (password !== confirmPassword) {
      setPwError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setPwError('Password must be at least 6 characters.')
      return
    }
    setPwLoading(true)
    setPwError('')
    setPwSuccess(false)
    try {
      const token = await getAdminToken()
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword: password }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'Failed to update password')
      }
      setPassword('')
      setConfirmPassword('')
      setPwSuccess(true)
      setTimeout(() => setPwSuccess(false), 4000)
    } catch (err) {
      setPwError(err.message)
    } finally {
      setPwLoading(false)
    }
  }

  async function handleAppSettings(e) {
    e.preventDefault()
    if (!appName.trim()) {
      setSettingsError('App name cannot be empty.')
      return
    }
    setSettingsLoading(true)
    setSettingsError('')
    setSettingsSuccess(false)
    try {
      const token = await getAdminToken()
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ appName }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'Failed to update settings')
      }
      setSettingsSuccess(true)
      setTimeout(() => setSettingsSuccess(false), 4000)
    } catch (err) {
      setSettingsError(err.message)
    } finally {
      setSettingsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-hearth-bg">
      {/* Header */}
      <header className="bg-white border-b border-hearth-border px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link to="/admin" className="text-hearth-muted hover:text-terra">
            <svg viewBox="0 0 20 20" className="w-5 h-5 fill-current">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold text-hearth-text">Settings</h1>
        </div>
        <button
          onClick={async () => { await logout(); navigate('/') }}
          className="text-sm text-hearth-muted hover:text-terra font-medium"
        >
          Sign out
        </button>
      </header>

      <div className="max-w-xl mx-auto px-4 py-8 space-y-8">
        {/* Change inner circle password */}
        <section className="card">
          <h2 className="text-lg font-bold text-hearth-text mb-1">Family Access Password</h2>
          <p className="text-sm text-hearth-muted mb-5">
            This is the shared password your family uses to enter the site. Change it here at any time.
          </p>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-hearth-text mb-1.5">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-hearth-text mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                required
                className="input-field"
              />
            </div>

            {pwError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {pwError}
              </div>
            )}
            {pwSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">
                Password updated! Share the new password with your family.
              </div>
            )}

            <button
              type="submit"
              disabled={pwLoading}
              className="btn-primary flex items-center gap-2"
            >
              {pwLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Updating…
                </>
              ) : 'Update Password'}
            </button>
          </form>
        </section>

        {/* App name */}
        <section className="card">
          <h2 className="text-lg font-bold text-hearth-text mb-1">App Settings</h2>
          <p className="text-sm text-hearth-muted mb-5">
            Customize the name shown across the app.
          </p>

          <form onSubmit={handleAppSettings} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-hearth-text mb-1.5">App Name</label>
              <input
                type="text"
                value={appName}
                onChange={e => setAppName(e.target.value)}
                placeholder="Our Hearth"
                className="input-field"
              />
            </div>

            {settingsError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                {settingsError}
              </div>
            )}
            {settingsSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">
                Settings saved!
              </div>
            )}

            <button
              type="submit"
              disabled={settingsLoading}
              className="btn-primary flex items-center gap-2"
            >
              {settingsLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Saving…
                </>
              ) : 'Save Settings'}
            </button>
          </form>
        </section>

        {/* Firestore rules reminder */}
        <section className="card border border-amber-200 bg-amber-50">
          <h3 className="text-sm font-bold text-amber-800 mb-1">Firestore Security Rules</h3>
          <p className="text-xs text-amber-700 leading-relaxed">
            Remember to deploy the Firestore security rules from <code className="bg-amber-100 px-1 rounded">firestore.rules</code> in the Firebase console.
            The <code>settings/app</code> document must only be readable by the server-side Admin SDK — never the client.
          </p>
        </section>
      </div>
    </div>
  )
}

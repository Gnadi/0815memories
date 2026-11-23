import { useId, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { Mail, KeyRound, Eye, EyeOff } from 'lucide-react'
import PasswordResetForm from './PasswordResetForm'

export function SetupBanner() {
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

export default function LoginForm({
  showAdminLogin, email, setEmail, password, setPassword,
  showPassword, setShowPassword, stayLoggedIn, setStayLoggedIn,
  error, loading, handleSubmit, tone = 'light', autoFocusPassword = false,
  resetOpen = false, setResetOpen,
}) {
  const { t } = useTranslation('auth')
  // The login designer previews this form next to the settings page's own
  // fields, so the ids have to be unique on any page.
  const id = useId()
  const emailId = `${id}-email`
  const passwordId = `${id}-password`
  const errorId = `${id}-error`
  const capsId = `${id}-caps`
  const invalidProps = error ? { 'aria-invalid': true, 'aria-describedby': errorId } : {}
  // A private key is typed blind; with Caps Lock on, every attempt fails for a
  // reason nobody can see.
  const [capsLock, setCapsLock] = useState(false)
  const trackCapsLock = (e) => setCapsLock(!!e.getModifierState?.('CapsLock'))
  // tone='dark' is used on dark login-card presets: labels flip to light
  // colors while the inputs keep their cream background and dark text.
  const labelClass = tone === 'dark' ? 'text-cream' : 'text-bark'
  const subtleClass = tone === 'dark' ? 'text-cream/80' : 'text-bark-light'
  const linkClass = tone === 'dark' ? 'text-cream/70 hover:text-cream' : 'text-bark-muted hover:text-kaydo'

  // Only admins have an account whose password can be reset; the family's
  // shared password is changed by an admin in the settings.
  if (showAdminLogin && resetOpen) {
    return <PasswordResetForm initialEmail={email} onBack={() => setResetOpen(false)} tone={tone} />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Admin email field */}
      {showAdminLogin && (
        <div>
          <label htmlFor={emailId} className={`block text-sm font-medium ${labelClass} mb-1.5`}>
            {t('login.form.familyEmailLabel')}
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" aria-hidden="true" />
            <input
              id={emailId}
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              enterKeyHint="next"
              autoCapitalize="none"
              spellCheck={false}
              {...invalidProps}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login.form.familyEmailPlaceholder')}
              className="w-full pl-12 pr-4 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-kaydo/30"
              required
            />
          </div>
        </div>
      )}

      {/* Password field */}
      <div>
        <label htmlFor={passwordId} className={`block text-sm font-medium ${labelClass} mb-1.5`}>
          {t('login.form.privateKeyLabel')}
        </label>
        <div className="relative">
          <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" aria-hidden="true" />
          {/* current-password lets password managers offer the saved key. */}
          <input
            id={passwordId}
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="go"
            onKeyDown={trackCapsLock}
            onKeyUp={trackCapsLock}
            onBlur={() => setCapsLock(false)}
            {...invalidProps}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus={autoFocusPassword}
            placeholder={t('login.form.privateKeyPlaceholder')}
            className="w-full pl-12 pr-12 py-3 bg-cream-dark rounded-xl border-none outline-none text-bark placeholder-bark-muted focus:ring-2 focus:ring-kaydo/30"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? t('hidePassword') : t('showPassword')}
            aria-controls={passwordId}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-bark-muted hover:text-bark"
          >
            {showPassword ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
          </button>
        </div>
        {capsLock && (
          <p id={capsId} role="status" className={`mt-1.5 text-xs ${tone === 'dark' ? 'text-amber-200' : 'text-amber-700'}`}>
            {t('login.form.capsLock')}
          </p>
        )}
      </div>

      {/* Stay logged in */}
      <div className="flex items-center justify-between gap-3">
        <label className={`flex items-center gap-2 text-sm ${subtleClass} cursor-pointer`}>
          <input
            type="checkbox"
            checked={stayLoggedIn}
            onChange={(e) => setStayLoggedIn(e.target.checked)}
            className="w-4 h-4 rounded border-bark-muted accent-kaydo"
          />
          {t('login.form.stayLoggedIn')}
        </label>
        {showAdminLogin && setResetOpen && (
          <button
            type="button"
            onClick={() => setResetOpen(true)}
            className={`text-sm transition-colors ${linkClass}`}
          >
            {t('login.form.forgotPassword')}
          </button>
        )}
      </div>

      {/* Error message */}
      {/* role="alert" so a screen reader announces it; it used to appear
          silently below the fields. */}
      {error && (
        <p id={errorId} role="alert" className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg">
          {error}
        </p>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="btn-kaydo w-full flex items-center justify-center gap-2 text-lg disabled:opacity-60"
      >
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
            {/* The spinner alone left the button without a name. */}
            <span className="sr-only">{t('login.form.submit')}</span>
          </>
        ) : (
          <>
            {t('login.form.submit')}
            <span className="text-xl" aria-hidden="true">&rarr;</span>
          </>
        )}
      </button>
    </form>
  )
}

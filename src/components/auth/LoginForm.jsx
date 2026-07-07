import { useTranslation, Trans } from 'react-i18next'
import { Mail, KeyRound, Eye, EyeOff } from 'lucide-react'

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
}) {
  const { t } = useTranslation('auth')
  // tone='dark' is used on dark login-card presets: labels flip to light
  // colors while the inputs keep their cream background and dark text.
  const labelClass = tone === 'dark' ? 'text-cream' : 'text-bark'
  const subtleClass = tone === 'dark' ? 'text-cream/80' : 'text-bark-light'
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Admin email field */}
      {showAdminLogin && (
        <div>
          <label className={`block text-sm font-medium ${labelClass} mb-1.5`}>
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
        <label className={`block text-sm font-medium ${labelClass} mb-1.5`}>
          {t('login.form.privateKeyLabel')}
        </label>
        <div className="relative">
          <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-bark-muted" />
          <input
            type={showPassword ? 'text' : 'password'}
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
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-bark-muted hover:text-bark"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Stay logged in */}
      <div className="flex items-center">
        <label className={`flex items-center gap-2 text-sm ${subtleClass} cursor-pointer`}>
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

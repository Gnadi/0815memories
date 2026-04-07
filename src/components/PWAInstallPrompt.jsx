import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const DISMISSED_KEY = 'pwa_install_dismissed_until'
const DISMISS_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Don't attach listeners if dismissed recently
    const dismissedUntil = localStorage.getItem(DISMISSED_KEY)
    if (dismissedUntil && Date.now() < Number(dismissedUntil)) return

    let showTimer

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      showTimer = setTimeout(() => setVisible(true), 2000)
    }

    const handleAppInstalled = () => setVisible(false)

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      clearTimeout(showTimer)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setVisible(false)
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setVisible(false)
    localStorage.setItem(DISMISSED_KEY, String(Date.now() + DISMISS_DURATION_MS))
  }

  if (!visible) return null

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      role="dialog"
      aria-label="Install Kaydo"
    >
      <div className="max-w-lg mx-auto bg-warm-white border-t border-cream-dark shadow-2xl rounded-t-2xl p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            {/* Inline house icon — no network request */}
            <div className="w-12 h-12 rounded-xl bg-cream flex items-center justify-center shrink-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 32 32"
                className="w-8 h-8"
                aria-hidden="true"
              >
                <path d="M16 4L3 14h3v13h8v-8h4v8h8V14h3L16 4z" fill="#C25A2E" />
                <circle cx="16" cy="15" r="3" fill="#FDF6EC" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-bark text-base leading-tight">Kaydo</p>
              <p className="text-bark-light text-sm mt-0.5">
                Add to your home screen for the best experience — works offline too.
              </p>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="text-bark-muted hover:text-bark transition-colors shrink-0 mt-0.5"
            aria-label="Dismiss install prompt"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleInstall}
            className="btn-kaydo text-sm px-5 py-2.5 shrink-0"
          >
            Add to Home Screen
          </button>
          <button
            onClick={handleDismiss}
            className="text-sm text-bark-muted hover:text-bark transition-colors font-medium"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}

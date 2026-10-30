import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { useAuth } from '../context/AuthContext'
import NotificationPrompt from './NotificationPrompt'
import { isPushOptedOut, listenForegroundMessages, requestAndSaveFCMToken } from '../utils/notifications'
import { devError } from '../utils/devLog'

// Lazy-loaded for signed-in visitors only (App.jsx): push pulls in Firestore,
// which a signed-out visit to the landing page has no use for.
// Handles push notification prompt + in-app foreground toast.
// Must be inside AuthProvider to access familyId.
export default function AppNotifications() {
  const { familyId, isAuthenticated: signedIn, isDemo } = useAuth()
  // A demo tab has no Firebase, so nothing to register for push or hear from.
  const isAuthenticated = signedIn && !isDemo
  const { t } = useTranslation('common')
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!isAuthenticated) return
    // The messaging SDK is code-split, so subscribing resolves a tick later.
    // Unsubscribing before then still has to work.
    let unsub = null
    let cancelled = false
    listenForegroundMessages(({ title, body }) => {
      setToast({ title, body })
      setTimeout(() => setToast(null), 5000)
    }).then((fn) => {
      if (cancelled) fn()
      else unsub = fn
    })
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [isAuthenticated])

  // Silently refresh the FCM token on each app load when the user already
  // granted notification permission (covers return visits where the prompt
  // won't show again because permission is no longer 'default'). It also keeps
  // the token document's `lang` and `uid` current — the server reads both when
  // it composes a notification. A device switched off in the settings stays
  // off, and a language switch is written right away rather than on the next
  // load, or notifications would keep arriving in the old language.
  useEffect(() => {
    if (!isAuthenticated || !familyId) return
    if (typeof window === 'undefined' || !('Notification' in window)) return
    const refresh = () => {
      if (Notification.permission !== 'granted' || isPushOptedOut()) return
      requestAndSaveFCMToken(familyId).catch((err) => devError('FCM token refresh failed:', err))
    }
    refresh()
    i18n.on('languageChanged', refresh)
    return () => i18n.off('languageChanged', refresh)
  }, [isAuthenticated, familyId])

  return (
    <>
      {isAuthenticated && <NotificationPrompt familyId={familyId} />}

      {/* In-app toast for foreground push messages */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm bg-bark text-warm-white rounded-2xl shadow-xl px-4 py-3 flex items-start gap-3 animate-fade-in">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-snug">{toast.title}</p>
            {toast.body && <p className="text-xs opacity-80 mt-0.5 leading-relaxed">{toast.body}</p>}
          </div>
          <button
            onClick={() => setToast(null)}
            className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity mt-0.5"
            aria-label={t('actions.dismiss')}
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}

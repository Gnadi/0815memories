import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import NotificationPrompt from './NotificationPrompt'
import AnniversaryReminder from './AnniversaryReminder'
import { listenForegroundMessages, requestAndSaveFCMToken } from '../utils/notifications'

// Handles push notification prompt + in-app foreground toast.
// Must be inside AuthProvider to access familyId.
export default function AppNotifications() {
  const { familyId, isAuthenticated } = useAuth()
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!isAuthenticated) return
    const unsub = listenForegroundMessages(({ title, body }) => {
      setToast({ title, body })
      setTimeout(() => setToast(null), 5000)
    })
    return unsub
  }, [isAuthenticated])

  // Silently refresh the FCM token on each app load when the user already
  // granted notification permission (covers return visits where the prompt
  // won't show again because permission is no longer 'default').
  useEffect(() => {
    if (!isAuthenticated || !familyId) return
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'granted') {
      requestAndSaveFCMToken(familyId).catch(() => {})
    }
  }, [isAuthenticated, familyId])

  return (
    <>
      {isAuthenticated && <NotificationPrompt familyId={familyId} />}
      {isAuthenticated && <AnniversaryReminder />}

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
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}

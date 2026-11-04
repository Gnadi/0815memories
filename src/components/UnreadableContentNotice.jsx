import { useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { subscribeUnreadable, unreadableSnapshot } from '../utils/unreadableContent'

const NONE = { generation: 0, count: 0 }

/**
 * Says, once for the whole app, that some entries did not decrypt. Each screen
 * shows such an entry without the affected fields (utils/encryption.js), and
 * not every screen has room to say why — this does.
 *
 * Closing it lasts until more entries turn up than it counted then, or a new
 * session or family starts the count again.
 */
export default function UnreadableContentNotice() {
  const { t } = useTranslation('common')
  const { generation, count } = useSyncExternalStore(subscribeUnreadable, unreadableSnapshot, () => NONE)
  const [dismissed, setDismissed] = useState(NONE)

  const stillDismissed = dismissed.generation === generation && count <= dismissed.count
  if (count === 0 || stillDismissed) return null
  return (
    <div
      role="status"
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm bg-bark text-warm-white rounded-2xl shadow-xl px-4 py-3 flex items-start gap-3 animate-fade-in"
    >
      <p className="flex-1 min-w-0 text-sm leading-snug">{t('unreadable.notice', { count })}</p>
      <button
        onClick={() => setDismissed({ generation, count })}
        className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity mt-0.5"
        aria-label={t('actions.dismiss')}
      >
        ×
      </button>
    </div>
  )
}

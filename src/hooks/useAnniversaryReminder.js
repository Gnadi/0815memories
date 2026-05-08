import { useEffect, useRef } from 'react'
import {
  doc,
  collection,
  addDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../context/AuthContext'
import {
  todayDateKey,
  countAnniversaryMemories,
  buildAnniversaryQueueDoc,
} from '../utils/anniversaryClient'

/**
 * Replaces the previous Vercel cron. Once per session per device, when an
 * admin opens the app, atomically claim today's "anniversary check" slot on
 * the family doc and — if we win — count any "today − 3 years" memories and
 * write to notificationsQueue. The existing dispatchPushNotifications Cloud
 * Function (auto-credentials) consumes the queue and sends FCM.
 */
export function useAnniversaryReminder() {
  const { isAdmin, familyId } = useAuth()
  const ranThisSession = useRef(false)

  useEffect(() => {
    if (!isAdmin || !familyId || !db) return
    if (ranThisSession.current) return
    ranThisSession.current = true

    let cancelled = false
    async function run() {
      const todayKey = todayDateKey()
      const familyRef = doc(db, 'families', familyId)

      // Acquire the daily lock atomically. If another device already claimed
      // today, the transaction commits without changes and we skip the rest.
      let weWonTheLock = false
      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(familyRef)
          if (!snap.exists()) return
          if (snap.data().lastAnniversaryCheckDate === todayKey) return
          tx.update(familyRef, { lastAnniversaryCheckDate: todayKey })
          weWonTheLock = true
        })
      } catch (err) {
        if (import.meta.env.DEV) console.error('[anniversary] lock failed', err)
        return
      }

      if (cancelled || !weWonTheLock) return

      try {
        const result = await countAnniversaryMemories(db, familyId)
        if (cancelled || !result) return
        await addDoc(
          collection(db, 'notificationsQueue'),
          { ...buildAnniversaryQueueDoc(familyId, result.count, result.year), createdAt: serverTimestamp() },
        )
      } catch (err) {
        if (import.meta.env.DEV) console.error('[anniversary] queue write failed', err)
      }
    }

    run()
    return () => { cancelled = true }
  }, [isAdmin, familyId])
}

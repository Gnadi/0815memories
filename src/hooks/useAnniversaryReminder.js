import { useEffect, useRef } from 'react'
import { doc, runTransaction } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAuth } from '../context/AuthContext'
import { todayDateKey, countAnniversaryMemories } from '../utils/anniversaryClient'
import { sendPush } from '../utils/pushTrigger'

/**
 * Replaces the previous cron — there is no scheduler on the free tier. Once per
 * session per device, when an admin opens the app, atomically claim today's
 * "anniversary check" slot on the family doc and — if we win — count any
 * "today − 3 years" memories and ask api/send-push to notify the family.
 *
 * Consequence of having no scheduler: the reminder only goes out on days an
 * admin actually opens Kaydo, at whatever time they do.
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
        await sendPush('anniversary', familyId, { count: result.count, year: result.year })
      } catch (err) {
        if (import.meta.env.DEV) console.error('[anniversary] push failed', err)
      }
    }

    run()
    return () => { cancelled = true }
  }, [isAdmin, familyId])
}

import { useEffect, useRef } from 'react'
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  runTransaction,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore'
import { useTranslation } from 'react-i18next'
import { db } from '../config/firebase'
import { useAuth } from '../context/AuthContext'
import { devError } from '../utils/devLog'
import { todayDateKey } from '../utils/anniversaryClient'
import { CHAPTERS, RITUALS } from './useOurYear'
import { isRitualDue, letterState, previousRitualDate, sortChapters } from '../utils/ourYear'

/**
 * The yearly nudge for "Our Year", built exactly like useAnniversaryReminder:
 * no scheduler, no server. Once per session, whichever partner opens the app
 * first claims today's slot on the ritual document and — if there is something
 * to say — writes to notificationsQueue for the Cloud Function to fan out.
 *
 * Two things are worth a push, and each only once:
 *   • a sealed letter has reached its open date;
 *   • the couple's chosen day has passed without a review covering it.
 *
 * Everything else (a chapter in progress, a partner waiting on answers) stays
 * inside the app — this ritual should never feel like it is nagging.
 *
 * The queue document carries `targetUids` so the dispatcher reaches only the
 * two partners, not every device in the family.
 */
export function useOurYearReminder() {
  const { isAdmin, familyId, user } = useAuth()
  const { t } = useTranslation('ourYear')
  const ranThisSession = useRef(false)

  const uid = user?.uid ?? null

  useEffect(() => {
    if (!isAdmin || !familyId || !uid || !db) return
    if (ranThisSession.current) return
    ranThisSession.current = true

    let cancelled = false

    async function run() {
      // 1. Find this person's ritual. No ritual, nothing to remind about.
      let ritual = null
      try {
        const snap = await getDocs(
          query(collection(db, RITUALS), where('participantUids', 'array-contains', uid)),
        )
        const match = snap.docs.find((d) => d.data().familyId === familyId)
        if (match) ritual = { id: match.id, ...match.data() }
      } catch (error) {
        devError('[ourYear] ritual lookup failed', error)
        return
      }
      if (cancelled || !ritual) return

      // 2. Claim today's slot, so a couple with several devices gets one push.
      const ritualRef = doc(db, RITUALS, ritual.id)
      const todayKey = todayDateKey()
      let weWonTheLock = false
      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(ritualRef)
          if (!snap.exists()) return
          if (snap.data().lastReminderKey === todayKey) return
          tx.update(ritualRef, { lastReminderKey: todayKey })
          weWonTheLock = true
        })
      } catch (error) {
        devError('[ourYear] lock failed', error)
        return
      }
      if (cancelled || !weWonTheLock) return

      // 3. Decide whether there is anything worth saying today.
      try {
        const chapterSnap = await getDocs(
          query(collection(db, CHAPTERS), where('ritualId', '==', ritual.id)),
        )
        const chapters = chapterSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        if (cancelled) return

        const notified = ritual.notifiedLetterChapters ?? []
        const waitingLetter = sortChapters(chapters).find(
          (c) => letterState(c) === 'waiting' && !notified.includes(c.id),
        )

        if (waitingLetter) {
          await enqueue(t('push.letterWaiting.title'), t('push.letterWaiting.body'))
          await runTransaction(db, async (tx) => {
            tx.update(ritualRef, { notifiedLetterChapters: arrayUnion(waitingLetter.id) })
          })
          return
        }

        if (isRitualDue(ritual, chapters)) {
          const due = previousRitualDate(ritual)
          const noticeKey = due ? todayDateKey(due) : null
          if (noticeKey && ritual.lastRitualNoticeKey !== noticeKey) {
            await enqueue(t('push.ritualDue.title'), t('push.ritualDue.body'))
            await runTransaction(db, async (tx) => {
              tx.update(ritualRef, { lastRitualNoticeKey: noticeKey })
            })
          }
        }
      } catch (error) {
        devError('[ourYear] queue write failed', error)
      }

      async function enqueue(title, body) {
        await addDoc(collection(db, 'notificationsQueue'), {
          familyId,
          targetUids: ritual.participantUids ?? [],
          title,
          body,
          url: '/our-year',
          createdAt: serverTimestamp(),
        })
      }
    }

    run()
    return () => { cancelled = true }
  }, [isAdmin, familyId, uid, t])
}

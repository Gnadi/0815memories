import { useState, useEffect } from 'react'
import { db } from '../config/firebase'
import { fetchTimelineYears, getOnThisDayMemories, subscribeYearMemories } from '../services/timeline'
import { devWarn } from '../utils/devLog'

// The Smart Timeline's state. Which range each view asks Firestore for, and
// why, is in services/timeline.js.

/**
 * @param {{ year: number|null, onThisDay: boolean }} view
 * @returns {{ years: number[], memories: object[], loading: boolean }}
 */
export function useTimeline(familyId, encryptionKey, { year, onThisDay }) {
  const [years, setYears] = useState({ familyId: null, list: [] })
  const [view, setView] = useState({ key: null, memories: [] })

  useEffect(() => {
    if (!familyId || !db) return
    let cancelled = false
    fetchTimelineYears(db, familyId)
      .then((list) => { if (!cancelled) setYears({ familyId, list }) })
      .catch((err) => {
        devWarn('Could not list the timeline years:', err?.code, err?.message)
        if (!cancelled) setYears({ familyId, list: [] })
      })
    return () => { cancelled = true }
  }, [familyId])

  const yearsReady = years.familyId === familyId
  const today = new Date()
  const dayKey = `${today.getMonth()}-${today.getDate()}`
  const viewKey = !familyId
    ? null
    : onThisDay
      ? yearsReady ? `day:${familyId}:${dayKey}:${years.list.join(',')}` : null
      : year ? `year:${familyId}:${year}` : null

  useEffect(() => {
    if (!viewKey || !db) return
    let cancelled = false
    const deliver = (memories) => {
      if (!cancelled) setView({ key: viewKey, memories })
    }
    const fail = (err) => {
      devWarn('Could not load the timeline:', err?.code, err?.message)
      if (!cancelled) setView({ key: viewKey, memories: [] })
    }

    if (onThisDay) {
      getOnThisDayMemories(familyId, years.list, encryptionKey).then(deliver, fail)
      return () => { cancelled = true }
    }
    const unsubscribe = subscribeYearMemories(familyId, year, encryptionKey, deliver, fail)
    return () => {
      cancelled = true
      unsubscribe()
    }
    // viewKey stands for familyId, year, onThisDay and the years list.
  }, [viewKey, encryptionKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const noMemories = yearsReady && years.list.length === 0
  return {
    years: yearsReady ? years.list : [],
    memories: view.key === viewKey && viewKey ? view.memories : [],
    loading: !!familyId && !noMemories && (!yearsReady || (!!viewKey && view.key !== viewKey) || (!viewKey && !onThisDay && !year)),
  }
}

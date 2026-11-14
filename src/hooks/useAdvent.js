import { useCallback, useEffect, useMemo, useState } from 'react'
import { db } from '../config/firebase'
import { getAdventEntries } from '../services/advent'
import { adventCandidates, adventLayout, adventYear, assignAdventDoors } from '../utils/advent'
import { devError } from '../utils/devLog'

/**
 * The advent calendar of the year `now` belongs to: its doors, where they
 * hang, and which of them this device has opened. How the doors are chosen is
 * in utils/advent.js.
 */
export function useAdventCalendar(familyId, encryptionKey, now = new Date()) {
  const year = adventYear(now)
  const [state, setState] = useState({ key: null, entries: null, error: null })
  const key = familyId ? `${familyId}:${year}` : null

  useEffect(() => {
    if (!key || !db) return
    let cancelled = false
    getAdventEntries(familyId, encryptionKey, year).then(
      (entries) => { if (!cancelled) setState({ key, entries, error: null }) },
      (error) => {
        devError('Reading the advent calendar’s entries failed', error)
        if (!cancelled) setState({ key, entries: null, error })
      },
    )
    return () => { cancelled = true }
  }, [key, familyId, encryptionKey, year])

  const ready = state.key === key
  const doors = useMemo(
    () => (ready && state.entries ? assignAdventDoors(adventCandidates(state.entries, year), { year, seed: familyId }) : []),
    [ready, state.entries, year, familyId],
  )
  const layout = useMemo(() => adventLayout({ year, seed: familyId || '' }), [year, familyId])
  const { opened, open } = useOpenedDoors(familyId, year)

  return { year, doors, layout, opened, open, loading: !!key && !ready, error: ready ? state.error : null }
}

// Which doors this device has opened, per family and year — only so an opened
// door stays open when the calendar is visited again. Day numbers, nothing of
// the family's; losing them closes the doors again, nothing worse.
const OPENED_KEY = 'kaydo_advent_opened'

function readOpened() {
  try {
    return JSON.parse(window.localStorage.getItem(OPENED_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

export function useOpenedDoors(familyId, year) {
  const storageKey = `${familyId}:${year}`
  const [state, setState] = useState(null)
  const opened = useMemo(
    () => (state?.storageKey === storageKey ? state.days : new Set(readOpened()[storageKey] || [])),
    [state, storageKey],
  )

  const open = useCallback((day) => {
    if (opened.has(day)) return
    const days = new Set(opened).add(day)
    setState({ storageKey, days })
    try {
      // Only this year's calendars are kept: last year's doors have no use.
      const kept = Object.fromEntries(Object.entries(readOpened()).filter(([k]) => k.endsWith(`:${year}`)))
      window.localStorage.setItem(OPENED_KEY, JSON.stringify({ ...kept, [storageKey]: [...days] }))
    } catch {
      // Private mode, full storage: the door closes again next visit.
    }
  }, [opened, storageKey, year])

  return { opened, open }
}

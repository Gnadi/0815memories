import { useCallback, useEffect, useState } from 'react'
import { db } from '../config/firebase'
import { getBestOf, getMonthEntries, saveBestOf, subscribeBestOfs } from '../services/bestOf'
import {
  BEST_OF_VERSION,
  buildBestOf,
  collectMedia,
  currentBestOfMonth,
  hasEnoughForBestOf,
  slideMedia,
} from '../utils/bestOf'
import { devError } from '../utils/devLog'

/**
 * The monthly best-of, from the app's side: finding a saved one, and making
 * one when there is none yet.
 *
 * Making one is automatic. An admin's device makes it in the background the
 * first time the moments row is shown after a month has ended, and saves it
 * for the family. Anyone who opens one that is not there yet — from the push
 * on the 1st, say, before any admin has been in the app — has it made right
 * there, while they watch; an admin's device saves that too, a viewer's
 * cannot, and does not need to: the composition is deterministic, so the
 * admin's will be the same story.
 */

// One making per family and month, shared by every screen that asks: the row
// starting it in the background and the viewer opened while it runs must not
// read the month twice, nor save it twice.
const makings = new Map()

/**
 * Make `month`'s best-of — and save it, on an admin's device. Resolves to the
 * best-of, or null when the month has too little for one.
 */
export function makeBestOf({ familyId, encryptionKey, month, isAdmin }) {
  const key = `${familyId}_${month}`
  if (!makings.has(key)) {
    const promise = (async () => {
      const { memories, moments } = await getMonthEntries(familyId, encryptionKey, month)
      const bestOf = buildBestOf({ month, memories, moments })
      if (bestOf && isAdmin) {
        // Not saving is no reason not to show it: it will be made again next time.
        await saveBestOf(familyId, encryptionKey, bestOf).catch((err) => devError('Saving the best-of failed', err))
      }
      return bestOf
    })()
    makings.set(key, promise)
    // A finished making is forgotten, so "make it again" makes it again — and
    // a failed one can be retried.
    promise.finally(() => makings.delete(key)).catch(() => {})
  }
  return makings.get(key)
}

/** The family's saved best-ofs, newest month first. */
export function useBestOfs(familyId, encryptionKey) {
  const [bestOfs, setBestOfs] = useState([])
  const [loadedFor, setLoadedFor] = useState(null)

  useEffect(() => {
    if (!familyId || !db) return
    return subscribeBestOfs(familyId, encryptionKey, (list) => {
      setBestOfs(list.filter((b) => b.doc && typeof b.doc === 'object'))
      setLoadedFor(familyId)
    }, (err) => {
      devError('Failed to load best-ofs', err)
      setLoadedFor(familyId)
    })
  }, [familyId, encryptionKey])

  const loading = !!familyId && !!db && loadedFor !== familyId
  return { bestOfs: loadedFor === familyId ? bestOfs : [], loading }
}

// Which months this device has watched, per family — only to tell the circle
// in the moments row whether to glow. Losing it costs one glow.
const SEEN_KEY = 'kaydo_bestof_seen'

function readSeen() {
  try {
    return JSON.parse(window.localStorage.getItem(SEEN_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

export function hasSeenBestOf(familyId, month) {
  return readSeen()[familyId] === month
}

export function markBestOfSeen(familyId, month) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify({ ...readSeen(), [familyId]: month }))
  } catch {
    // Private mode, full storage: the circle keeps glowing, nothing worse.
  }
}

// How long the home page is left alone before an admin's device starts making
// the best-of: the feed's own photos come first.
const BACKGROUND_DELAY_MS = 4000

/**
 * The best-of the moments row offers: last month's. Saved, or — while nobody
 * has made it yet — available to be made, when the month had enough for one.
 * On an admin's device that is when it gets made, in the background.
 *
 * Returns null while there is nothing to offer, else { month, cover, saved }.
 */
export function useCurrentBestOf({ familyId, encryptionKey, isAdmin, now }) {
  const [month] = useState(() => currentBestOfMonth(now))
  const { bestOfs, loading } = useBestOfs(familyId, encryptionKey)
  const saved = bestOfs.find((b) => b.month === month)

  // For a month nobody has made yet: whether it had enough, and its cover.
  const [pending, setPending] = useState(null) // { for, cover } | { for, cover: null }
  const pendingFor = `${familyId}_${month}`
  const lookAtMonth = !loading && !saved && !!familyId && !!db

  useEffect(() => {
    if (!lookAtMonth) return
    let cancelled = false
    getMonthEntries(familyId, encryptionKey, month)
      .then(({ memories, moments }) => {
        if (cancelled) return
        const media = collectMedia({ memories, moments })
        const cover = hasEnoughForBestOf(media) ? media.find((m) => m.type === 'image') : null
        setPending({ for: pendingFor, cover: cover ? slideMedia(cover) : null })
      })
      .catch((err) => devError('Failed to look at last month', err))
    return () => { cancelled = true }
  }, [lookAtMonth, familyId, encryptionKey, month, pendingFor])

  const available = !saved && pending?.for === pendingFor && !!pending.cover

  // An admin's device makes it, once the page has settled. The subscription
  // above then picks the saved one up, and the row shows its real cover.
  useEffect(() => {
    if (!available || !isAdmin) return
    const timer = setTimeout(() => {
      makeBestOf({ familyId, encryptionKey, month, isAdmin }).catch((err) => devError('Making the best-of failed', err))
    }, BACKGROUND_DELAY_MS)
    return () => clearTimeout(timer)
  }, [available, isAdmin, familyId, encryptionKey, month])

  if (saved) return { month, cover: saved.doc.cover, saved: true }
  if (available) return { month, cover: pending.cover, saved: false }
  return null
}

/**
 * One month's best-of, for the viewer: the saved one, or one made now.
 *
 * status: 'loading' → 'making' → 'ready' | 'empty' | 'error'
 */
export function useBestOfMonth({ familyId, encryptionKey, isAdmin, month }) {
  const [state, setState] = useState({ for: null, status: 'loading', bestOf: null })
  const [attempt, setAttempt] = useState(0)
  const [remaking, setRemaking] = useState(false)
  const target = month && familyId ? `${familyId}_${month}:${attempt}` : null

  useEffect(() => {
    if (!target || !db) return
    let cancelled = false
    const set = (patch) => {
      if (!cancelled) setState((prev) => ({ ...prev, for: target, ...patch }))
    }
    const make = () => {
      set({ status: 'making' })
      return makeBestOf({ familyId, encryptionKey, month, isAdmin })
        .then((bestOf) => set({ status: bestOf ? 'ready' : 'empty', bestOf }))
    }
    ;(async () => {
      try {
        const saved = remaking ? null : await getBestOf(familyId, encryptionKey, month)
        // One from an older version of the story is made again where it can
        // be saved again; elsewhere it is still worth watching as it is.
        const current = saved?.doc && typeof saved.doc === 'object' &&
          (saved.version === BEST_OF_VERSION || !isAdmin)
        if (current) set({ status: 'ready', bestOf: saved.doc })
        else await make()
      } catch (err) {
        devError('Failed to load the best-of', err)
        set({ status: 'error' })
      }
    })()
    return () => { cancelled = true }
  }, [target, familyId, encryptionKey, month, isAdmin, remaking])

  const retry = useCallback(() => {
    setRemaking(false)
    setAttempt((n) => n + 1)
  }, [])
  // An admin's "make it again": a month whose photos came in late, say.
  const remake = useCallback(() => {
    setRemaking(true)
    setAttempt((n) => n + 1)
  }, [])

  const current = state.for === target ? state : { status: 'loading', bestOf: null }
  return { ...current, retry, remake }
}

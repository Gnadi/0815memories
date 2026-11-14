import { useState, useEffect, useCallback } from 'react'
import { db } from '../config/firebase'
import {
  addBox,
  deleteBox,
  getBoxContent,
  setUnlockDate,
  subscribeBoxes,
  updateBox,
} from '../services/blackbox'

// A capsule is two documents, the card's metadata and the sealed letter — see
// services/blackbox.js.

// What a legacy capsule's first deadline is set to, and how far each check-in
// pushes it out. A year is long enough not to nag someone living their life, and
// short enough that a capsule reaches its family in good time.
export const LEGACY_GRACE_MONTHS = 12

/** `date` plus n months, clamped so 31 January + 1 month is not 3 March. */
export function addMonths(date, months) {
  const d = new Date(date)
  const targetDay = d.getDate()
  d.setMonth(d.getMonth() + months)
  if (d.getDate() < targetDay) d.setDate(0)
  return d
}

export function useBlackBox(familyId, encryptionKey) {
  const [boxes, setBoxes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!familyId || !db) {
      setLoading(false)
      return
    }

    return subscribeBoxes(familyId, encryptionKey, (list) => {
      setBoxes(list)
      setLoading(false)
    }, (err) => {
      if (import.meta.env.DEV) console.error('useBlackBox snapshot error:', err)
      setLoading(false)
    })
  }, [familyId, encryptionKey])

  const fetchContent = useCallback(
    async (box) => (db ? getBoxContent(encryptionKey, box) : null),
    [encryptionKey]
  )

  /**
   * Push a legacy capsule's deadline out by another grace window.
   *
   * This is the whole dead-man's switch: the capsule opens on its own unless
   * someone keeps moving the date. The rules only permit forward moves, so this
   * can be offered freely.
   */
  const checkIn = async (box, months = LEGACY_GRACE_MONTHS) => {
    const from = box.unlockDate?.toDate ? box.unlockDate.toDate() : new Date()
    // Measured from today when the deadline has already slipped into the past,
    // so a late check-in still buys a full window rather than a moment.
    const base = from > new Date() ? from : new Date()
    await setUnlockDate(box.id, addMonths(base, months))
  }

  return {
    boxes,
    loading,
    addBox: (box) => addBox(familyId, encryptionKey, box),
    updateBox: (id, updates) => updateBox(encryptionKey, id, updates),
    deleteBox: (id) => deleteBox(id),
    fetchContent,
    checkIn,
  }
}

/**
 * Has this capsule opened?
 *
 * Presentation only — firestore.rules is what actually withholds the letter. A
 * legacy capsule needs no special case any more: it is a capsule whose date
 * keeps being pushed forward, so when the pushing stops, the date arrives.
 */
export function isUnlocked(box) {
  if (!box.unlockDate) return false
  const unlock = box.unlockDate.toDate ? box.unlockDate.toDate() : new Date(box.unlockDate)
  return unlock <= new Date()
}

/** Days until a capsule opens; negative once it has. */
export function daysUntilUnlock(box, now = new Date()) {
  if (!box.unlockDate) return null
  const unlock = box.unlockDate.toDate ? box.unlockDate.toDate() : new Date(box.unlockDate)
  return Math.ceil((unlock - now) / 86_400_000)
}

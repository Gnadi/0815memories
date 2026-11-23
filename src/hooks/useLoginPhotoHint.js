import { useEffect, useState } from 'react'
import { db } from '../config/firebase'
import { subscribeFamily } from '../services/family'

// How long "Not now" keeps the hint away on this device.
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000
const snoozeKey = (familyId) => `kaydo_login_photo_hint:${familyId}`

function snoozedUntil(familyId) {
  try {
    return Number(window.localStorage.getItem(snoozeKey(familyId))) || 0
  } catch {
    return 0
  }
}

/**
 * Whether to suggest to an admin that the family's login page get a photo of
 * the family.
 *
 * Everyone in the family meets the login page first, and a photo of their own
 * is the warmest welcome it can give; the standard illustration is for until
 * then. Admins could always upload one in the settings, but nothing said so.
 * The suggestion goes once the family has a photo or a design of its own, and
 * "Not now" keeps it away from this device for a month.
 *
 * @returns {{ show: boolean, snooze: () => void }}
 */
export function useLoginPhotoHint(familyId, isAdmin) {
  const [family, setFamily] = useState(null)
  // Read once: whether "Not now" was said less than a month ago.
  const [snoozed, setSnoozed] = useState(() => snoozedUntil(familyId) > Date.now())

  useEffect(() => {
    if (!isAdmin || !familyId || !db) return
    return subscribeFamily(familyId, setFamily, () => setFamily(null))
  }, [familyId, isAdmin])

  const mode = family?.loginPageMode
  const hasOwnLook = !!family?.loginHeaderImage || mode === 'theme' || mode === 'custom'
  const show = !!isAdmin && !!family && !hasOwnLook && !snoozed

  const snooze = () => {
    try {
      window.localStorage.setItem(snoozeKey(familyId), String(Date.now() + SNOOZE_MS))
    } catch {
      // Storage blocked: it goes for this visit only.
    }
    setSnoozed(true)
  }

  return { show, snooze }
}

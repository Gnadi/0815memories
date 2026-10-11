import { useState, useEffect, useRef, useCallback } from 'react'
import { db } from '../config/firebase'
import { subscribeFamily } from '../services/family'
import { importEncryptionKey } from '../utils/encryption'
import { readStored, writeStored } from '../utils/authStorage'
import { devWarn } from '../utils/devLog'
import { isDemoMode } from '../demo/demoMode'

// Read once per page load, as everything else of the demo reads it: entering
// and leaving it are hard navigations (demo/demoMode.js).
const DEMO = isDemoMode()

// Backoff for re-reading the family document after the listener errors, in ms.
// Front-loaded because the two errors worth retrying — the auth token not yet
// on the Firestore stream, and an admin claim the trigger has not written —
// both clear within about a second.
const KEY_RETRY_DELAYS = [300, 800, 2000, 5000, 10000]

const VALID_CARD_STYLES = ['modern', 'classic', 'polaroid']
const normalizeCardStyle = (value) => (VALID_CARD_STYLES.includes(value) ? value : 'modern')

/**
 * The family document's part of the session: the key the family's content is
 * encrypted with, and the card style, both read from one subscription.
 *
 * Kept out of AuthContext, which decides who is signed in and to which family,
 * because this is where a mistake costs the most: a session that goes on
 * without its key writes family content in plaintext. Here it is small enough
 * to read in one sitting, and testable on its own.
 *
 * @param familyId       the family the session is bound to, or null
 * @param user           the signed-in user; a change re-subscribes (see below)
 * @param refreshClaims  forces a fresh ID token for `user` before a retry
 */
export function useFamilyKey(familyId, user, refreshClaims) {
  const [encryptionKey, setEncryptionKey] = useState(null)
  // The family whose key is in hand — or, in the demo, whose family has none to
  // wait for. Anything else is still loading, unless keyProblem says otherwise.
  //
  // This used to be a `keyLoading` boolean that the loader effect switched on.
  // An effect runs after the commit, so between the render that learned the
  // family id and the effect that followed it, the app said: no key, and none
  // on the way. ProtectedRoute opened on that frame and every encrypted photo
  // in it resolved to its raw Cloudinary URL — the exact state
  // useDecryptedMedia reads as "this asset predates encryption".
  //
  // On a first login that frame is guaranteed: nothing is in localStorage yet,
  // so the flag could only start false. Deriving it instead means the answer is
  // right from the same render that sets the family id, with no gap to lose.
  const [keyReadyFor, setKeyReadyFor] = useState(null)
  // Why the key will not come, as { familyId, reason }: 'missing' (the family
  // document has none), 'unreadable' (this browser cannot import it),
  // 'unavailable' (the document could not be read) or 'deleted' (its owner
  // deleted the family, and the key left with that). Each of these used to open
  // the app without a key — a document without one counted as a family from
  // before encryption, which Kaydo no longer supports — and from then on every
  // write stored family content in plaintext. ProtectedRoute shows the reason
  // instead of the app.
  const [keyProblem, setKeyProblem] = useState(null)
  // Remembered so the first frame picks the same card component the family doc
  // will confirm. Guessing 'modern' and correcting later swaps the component
  // type and remounts every card, and with it every image.
  const [memoryCardStyle, setMemoryCardStyle] = useState(() =>
    normalizeCardStyle(readStored('fh_cardStyle'))
  )

  // No family means nothing to load a key for — the landing and login pages.
  const keyLoading = !!familyId && keyReadyFor !== familyId
  const keyError = familyId && keyProblem?.familyId === familyId ? keyProblem.reason : null

  // Family whose key is already imported. Guards against re-importing on every
  // auth-object change: importEncryptionKey() mints a new CryptoKey each call,
  // and that identity sits in the dependency array of every Firestore listener
  // and every media decrypt effect in the app.
  const keyLoadedForRef = useRef(null)

  // One live subscription to the family document, serving both the encryption
  // key and the card style.
  //
  // This used to be a getDoc for the key plus a separate onSnapshot for the
  // style — two reads of the same document, with the getDoc sitting on the
  // critical path before ProtectedRoute would open.
  //
  // Depending on user re-subscribes when Firebase Auth is restored after the
  // initial mount, which fixes the race where familyId was set from localStorage
  // before the auth token was ready and the first Firestore read failed silently.
  useEffect(() => {
    if (!familyId || !db) return

    // Only a genuine family switch invalidates the key we hold.
    if (keyLoadedForRef.current !== null && keyLoadedForRef.current !== familyId) {
      setEncryptionKey(null)
      keyLoadedForRef.current = null
      setKeyReadyFor(null)
    }

    // Re-close the gate, and forget why an earlier attempt failed, whenever this
    // runs without a key in hand. After the read below has been given up, a
    // later auth event is the one chance to try again.
    if (keyLoadedForRef.current !== familyId) {
      setKeyReadyFor(null)
      setKeyProblem(null)
    }

    let cancelled = false
    let unsub = null
    let retryTimer = null
    let attempt = 0

    const openGate = () => {
      if (!cancelled) setKeyReadyFor(familyId)
    }

    const failKey = (reason) => {
      if (!cancelled) setKeyProblem({ familyId, reason })
    }

    const subscribe = () => {
      unsub = subscribeFamily(
        familyId,
        async (data) => {
          if (cancelled || !data) return
          attempt = 0

          // Whether or not the key is already here: a family on its way out
          // shows nothing more (functions/familyDeletion.js).
          if (data.deletionRequestedAt) {
            failKey('deleted')
            return
          }

          const style = normalizeCardStyle(data.memoryCardStyle)
          setMemoryCardStyle(style)
          writeStored('fh_cardStyle', style)

          // Import once per family. importEncryptionKey() mints a new CryptoKey on
          // every call, and that identity sits in the dependency array of every
          // Firestore listener and every media decrypt effect in the app — so
          // re-importing on each snapshot would restart all of them.
          if (keyLoadedForRef.current !== familyId) {
            if (!data.encryptionKeyJwk) {
              // The demo family is the only one without a key, and it needs
              // none (demo/). Every other family has had one since signup.
              if (DEMO) {
                keyLoadedForRef.current = familyId
                openGate()
              } else {
                failKey('missing')
              }
              return
            }
            let key
            try {
              key = await importEncryptionKey(data.encryptionKeyJwk)
            } catch (err) {
              if (import.meta.env.DEV) console.error('Failed to import encryption key:', err)
              failKey('unreadable')
              return
            }
            if (cancelled) return
            setEncryptionKey(key)
            keyLoadedForRef.current = familyId
            openGate()
          }
        },
        (err) => {
          if (cancelled) return
          devWarn('Failed to load family document:', err?.code, err?.message)
          unsub?.()
          unsub = null

          // A Firestore listener that errors is finished — it does not retry a
          // permission-denied stream on its own, so somebody has to.
          //
          // And permission-denied is the likely error here. The rules answer on
          // the ID token, which reaches the Firestore stream a moment after
          // sign-in returns; an invited admin has it worse still, because their
          // role claim is written by a trigger that has not run yet, so the
          // rules fall back to reading adminUids and that read races the write
          // that put them there. Both clear on their own within a second or two.
          //
          // Giving up after one attempt is what made a first login look broken:
          // the session held no key, nothing said one was coming, and in that
          // state every encrypted photo resolved to its raw ciphertext URL.
          // Nothing re-subscribed, because neither familyId nor user changed
          // again, so it stayed that way until the page was reloaded.
          if (attempt >= KEY_RETRY_DELAYS.length) {
            // Out of retries. This used to open the app anyway, keyless, so it
            // would not sit behind ProtectedRoute's spinner — and every write
            // from then on went out in plaintext. Say so instead.
            failKey('unavailable')
            return
          }
          const delay = KEY_RETRY_DELAYS[attempt++]
          retryTimer = setTimeout(async () => {
            if (cancelled) return
            // Force a fresh ID token before trying again: a claim written after
            // we subscribed is exactly what changes the answer, and nothing
            // picks it up otherwise.
            await refreshClaims(user).catch(() => {})
            if (cancelled) return
            subscribe()
          }, delay)
        },
      )
    }

    subscribe()

    return () => {
      cancelled = true
      clearTimeout(retryTimer)
      unsub?.()
    }
  }, [familyId, user, refreshClaims])


  // A key the session made itself: signup generates it locally, so there is
  // nothing to wait for, and importing it again from the document would hand
  // every consumer a new identity. Settled in the same batch as the family id,
  // keyLoading stays false throughout.
  const adoptKey = useCallback((id, key) => {
    setEncryptionKey(key)
    keyLoadedForRef.current = id
    setKeyReadyFor(id)
  }, [])

  // Signing out: nothing of the family stays behind in the session.
  const forgetKey = useCallback(() => {
    keyLoadedForRef.current = null
    setEncryptionKey(null)
    setKeyReadyFor(null)
    setKeyProblem(null)
    setMemoryCardStyle('modern')
  }, [])

  return { encryptionKey, keyLoading, keyError, memoryCardStyle, adoptKey, forgetKey }
}

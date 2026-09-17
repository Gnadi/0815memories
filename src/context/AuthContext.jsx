import { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updateProfile, signOut, setPersistence, browserLocalPersistence, browserSessionPersistence,
  signInWithCustomToken,
} from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { doc, addDoc, collection, query, where, getDocs, serverTimestamp, updateDoc, onSnapshot } from 'firebase/firestore'
import { auth, db, functions } from '../config/firebase'
import { generateSlug, isSlugAvailable } from '../utils/familySlug'
import { generateEncryptionKey, importEncryptionKey, clearDecryptedTextCache } from '../utils/encryption'
import { clearDecryptedMediaCache } from '../components/media/useDecryptedMedia'
import { terminateDecryptPool } from '../utils/decryptPool'
import { readStored, writeStored, clearStoredSession, setSessionOnly } from '../utils/authStorage'
import { devWarn } from '../utils/devLog'

const AuthContext = createContext(null)

const VALID_CARD_STYLES = ['modern', 'classic', 'polaroid']
const normalizeCardStyle = (value) => (VALID_CARD_STYLES.includes(value) ? value : 'modern')

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null) // Firebase user — admin *or* viewer
  // The role comes from the ID token, never from the client.
  //
  // This used to be `isAdmin = !!user`, which was correct only while viewers
  // had no Firebase session at all. They have one now, so that test would make
  // every viewer an administrator and wave them straight through
  // ProtectedRoute's adminOnly gate.
  //
  // 'viewer' is only ever minted by the viewerLogin function, so anything else
  // holding a session is an admin — including an admin whose claim the sync
  // trigger has not written yet.
  const [role, setRole] = useState(null)
  const [familyId, setFamilyId] = useState(() => readStored('fh_familyId'))
  const [encryptionKey, setEncryptionKey] = useState(null)
  // Start "loading" whenever a family is already known from localStorage. The
  // key fetch cannot begin until after the first paint, and ProtectedRoute
  // gates on this flag — leaving it false meant the app painted once with a
  // null key, then unmounted the whole tree for the spinner, then remounted it.
  const [keyLoading, setKeyLoading] = useState(() => !!readStored('fh_familyId'))
  // Remembered so the first frame picks the same card component the family doc
  // will confirm. Guessing 'modern' and correcting later swaps the component
  // type and remounts every card, and with it every image.
  const [memoryCardStyle, setMemoryCardStyle] = useState(() =>
    normalizeCardStyle(readStored('fh_cardStyle'))
  )
  const [loading, setLoading] = useState(true)
  const firebaseReady = !!(auth && db)

  // Family whose key is already imported. Guards against re-importing on every
  // auth-object change: importEncryptionKey() mints a new CryptoKey each call,
  // and that identity sits in the dependency array of every Firestore listener
  // and every media decrypt effect in the app.
  const keyLoadedForRef = useRef(null)

  // Defined before the effects that depend on it: the dependency array is read
  // during render, so a `const` declared further down would be in its TDZ.
  const resolveFamilyId = useCallback(async (uid) => {
    // Primary lookup: multi-admin shape.
    const byAdmins = await getDocs(
      query(collection(db, 'families'), where('adminUids', 'array-contains', uid))
    )
    let snapshot = byAdmins
    // Fallback for families that haven't been lazily migrated yet (no adminUids field).
    if (snapshot.empty) {
      snapshot = await getDocs(
        query(collection(db, 'families'), where('adminUid', '==', uid))
      )
    }
    if (snapshot.empty) return null
    const familyDoc = snapshot.docs[0]
    const id = familyDoc.id
    const data = familyDoc.data()
    // Lazy migration: if the owner logs in before the family has an `adminUids`
    // array, backfill it now so subsequent rule checks use the new shape.
    if (data.adminUid === uid && !Array.isArray(data.adminUids)) {
      try {
        await updateDoc(doc(db, 'families', id), { adminUids: [uid] })
      } catch (err) {
        if (import.meta.env.DEV) console.error('Lazy adminUids migration failed:', err)
      }
    }
    setFamilyId(id)
    writeStored('fh_familyId', id)
    return id
  }, [])

  // Read role and family straight off the ID token. Both are set by the server
  // — the viewerLogin function for viewers, the syncAdminClaims trigger for
  // admins — so neither can be forged by editing localStorage.
  const applyClaims = useCallback(async (firebaseUser, { force = false } = {}) => {
    if (!firebaseUser) {
      setRole(null)
      return null
    }
    let claims = null
    try {
      claims = (await firebaseUser.getIdTokenResult(force)).claims ?? {}
    } catch (err) {
      devWarn('Could not read auth claims:', err)
    }
    if (!claims) {
      // Fail closed. An unreadable token means the role is unknown, and unknown
      // must not resolve to 'admin' — that is the direction that hands a viewer
      // the admin UI. They stay signed in with no privileges until the next
      // auth event, which a reload provides.
      setRole(null)
      return null
    }
    setRole(claims.role === 'viewer' ? 'viewer' : 'admin')

    const claimFamily = typeof claims.familyId === 'string' ? claims.familyId : null
    if (claimFamily) {
      setFamilyId(claimFamily)
      writeStored('fh_familyId', claimFamily)
    }
    return claimFamily
  }, [])

  // The claim is written by a Firestore trigger, so it lands a moment after the
  // family document does. Nothing blocks on it — firestore.rules still accepts
  // the adminUids path — but picking it up promptly keeps the two in step, and
  // is what the rules will rely on once that fallback is retired.
  const pollForFamilyClaim = useCallback(async (firebaseUser) => {
    for (const delay of [1200, 2500, 5000]) {
      await new Promise((resolve) => setTimeout(resolve, delay))
      const claimFamily = await applyClaims(firebaseUser, { force: true })
      if (claimFamily) return
    }
  }, [applyClaims])

  useEffect(() => {
    if (!auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      const claimFamily = await applyClaims(firebaseUser)
      // Admins from before the claim migration have no familyId in their token.
      // The adminUids lookup stays as the fallback for exactly them.
      if (firebaseUser && !claimFamily && !readStored('fh_familyId')) {
        await resolveFamilyId(firebaseUser.uid)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [resolveFamilyId, applyClaims])

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
    }
    if (keyLoadedForRef.current !== familyId) setKeyLoading(true)

    let cancelled = false

    const unsub = onSnapshot(
      doc(db, 'families', familyId),
      async (snap) => {
        if (cancelled || !snap.exists()) return
        const data = snap.data()

        const style = normalizeCardStyle(data.memoryCardStyle)
        setMemoryCardStyle(style)
        writeStored('fh_cardStyle', style)

        // Import once per family. importEncryptionKey() mints a new CryptoKey on
        // every call, and that identity sits in the dependency array of every
        // Firestore listener and every media decrypt effect in the app — so
        // re-importing on each snapshot would restart all of them.
        if (keyLoadedForRef.current !== familyId) {
          try {
            if (data.encryptionKeyJwk) {
              const key = await importEncryptionKey(data.encryptionKeyJwk)
              if (cancelled) return
              setEncryptionKey(key)
            }
            // Resolved: a family doc without a key is a family that predates
            // encryption, which is a valid end state, not a failure.
            keyLoadedForRef.current = familyId
          } catch (err) {
            if (import.meta.env.DEV) console.error('Failed to import encryption key:', err)
          } finally {
            if (!cancelled) setKeyLoading(false)
          }
        }
      },
      (err) => {
        if (import.meta.env.DEV) console.error('Failed to load family document:', err)
        // Left unresolved on purpose: usually the read racing the auth token,
        // and the `user` dependency exists so it can be retried once it lands.
        if (!cancelled) setKeyLoading(false)
      },
    )

    return () => {
      cancelled = true
      unsub()
    }
  }, [familyId, user])

  // Explicitly bind the session to a family without going through a lookup.
  // Used right after invite redemption, where the new admin's UID has just been
  // added to the family but a fresh resolveFamilyId() query may race the write
  // (or the onAuthStateChanged-triggered lookup already ran before the write).
  const setActiveFamilyId = useCallback((id) => {
    if (!id) return
    setFamilyId(id)
    writeStored('fh_familyId', id)
  }, [])

  // `remember` is the "Stay logged in" box, on by default. It decides how long
  // the session outlives the window — see utils/authStorage.
  //
  // The password is no longer checked here. It is checked by the viewerLogin
  // Cloud Function, which holds the only readable copy of the hash and answers
  // with a custom token carrying a `familyId` claim. That claim is what
  // firestore.rules reads — which is the whole reason a viewer can now be told
  // apart from a stranger.
  const loginAsViewer = useCallback(async (password, viewerFamilyId, { remember = true } = {}) => {
    if (!auth || !functions) throw new Error('Firebase not configured — add env vars and reload')
    if (!viewerFamilyId) throw new Error('No family link provided')

    // Chosen before the sign-in: setPersistence only applies to sessions opened
    // after it resolves, and it decides where the refresh token is written.
    setSessionOnly(!remember)
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence)
    } catch (err) {
      devWarn('Could not set auth persistence:', err)
    }

    let token
    try {
      const result = await httpsCallable(functions, 'viewerLogin')({
        familyId: viewerFamilyId,
        password,
      })
      token = result?.data?.token
    } catch (err) {
      // The function answers every failure identically on purpose, so that this
      // endpoint cannot be used to find out which families exist. The one case
      // worth naming is the throttle, which is about the caller, not the family.
      if (err?.code === 'functions/resource-exhausted') {
        throw new Error('Too many attempts — please wait a moment and try again')
      }
      throw new Error('Invalid password')
    }
    if (!token) throw new Error('Invalid password')

    await signInWithCustomToken(auth, token)
    // onAuthStateChanged reads the claim and sets the family; this write just
    // gets it into storage before the first render.
    setFamilyId(viewerFamilyId)
    writeStored('fh_familyId', viewerFamilyId)
  }, [])

  const loginAsAdmin = useCallback(async (email, password, { remember = true } = {}) => {
    if (!auth) throw new Error('Firebase not configured — add env vars and reload')
    // Must precede the sign-in: setPersistence decides where the SDK writes the
    // refresh token, and it only applies to sessions opened after it resolves.
    // Local persistence (the default we now state explicitly) survives a browser
    // restart; session persistence dies with the window, matching the storage
    // side below. A browser that denies IndexedDB rejects here — the sign-in is
    // still worth attempting, it just falls back to the SDK's in-memory default.
    setSessionOnly(!remember)
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence)
    } catch (err) {
      if (import.meta.env.DEV) console.warn('Could not set auth persistence:', err)
    }
    const result = await signInWithEmailAndPassword(auth, email, password)
    const resolved = await resolveFamilyId(result.user.uid)
    if (!resolved) {
      // The Firebase Auth account exists but no family lists this UID — most
      // likely because the user was removed by another admin. Sign them back
      // out so they don't sit in a half-authed state.
      await signOut(auth)
      throw new Error('This account is no longer associated with any family. Ask a family admin for a new invite link.')
    }
  }, [resolveFamilyId])

  const signup = useCallback(async (email, password, displayName, familyName) => {
    if (!auth || !db) throw new Error('Firebase not configured — add env vars and reload')

    const name = familyName || displayName + "'s Family"
    const slug = generateSlug(name)
    if (!slug) throw new Error('Family name produces an invalid URL — please use letters or numbers')

    const available = await isSlugAvailable(slug)
    if (!available) throw new Error('This family name is already taken — please choose another')

    // A brand-new family is always remembered; clears any session-only marker
    // left in this window by an earlier login.
    setSessionOnly(false)
    try {
      await setPersistence(auth, browserLocalPersistence)
    } catch (err) {
      if (import.meta.env.DEV) console.warn('Could not set auth persistence:', err)
    }

    const result = await createUserWithEmailAndPassword(auth, email, password)
    if (displayName) {
      await updateProfile(result.user, { displayName })
    }

    // Generate a per-family encryption key
    const { key, jwk } = await generateEncryptionKey()
    setEncryptionKey(key)

    // Create the family document with the encryption key
    const familyRef = await addDoc(collection(db, 'families'), {
      adminUid: result.user.uid,
      adminUids: [result.user.uid],
      familyName: name,
      familySlug: slug,
      encryptionKeyJwk: jwk,
      createdAt: serverTimestamp(),
    })
    // The key was just generated locally — no need for the loader effect to
    // fetch and re-import it, which would hand every consumer a fresh identity.
    keyLoadedForRef.current = familyRef.id
    setFamilyId(familyRef.id)
    writeStored('fh_familyId', familyRef.id)
    // Not awaited: the app is usable immediately via the adminUids rule path,
    // and the claim only has to arrive before that path is retired.
    pollForFamilyClaim(result.user)
  }, [pollForFamilyClaim])

  const logout = useCallback(async () => {
    if (user && auth) {
      await signOut(auth)
      // The SDK's persistence mode is sticky for the life of the page, and the
      // storage side is about to be reset to "remembered" by clearStoredSession.
      // Without this, a session-only login followed by a logout and then any
      // sign-in that does not go through loginAsAdmin — invite redemption calls
      // createUserWithEmailAndPassword directly — would leave the token dying
      // with the window while the family binding sat in localStorage.
      try {
        await setPersistence(auth, browserLocalPersistence)
      } catch (err) {
        if (import.meta.env.DEV) console.warn('Could not reset auth persistence:', err)
      }
    }
    keyLoadedForRef.current = null
    setRole(null)
    setFamilyId(null)
    setEncryptionKey(null)
    setKeyLoading(false)
    setMemoryCardStyle('modern')
    // Decrypted media outlives the session otherwise: the object URLs stay
    // resolvable for as long as the tab is open.
    clearDecryptedMediaCache()
    clearDecryptedTextCache()
    // The workers hold the family key; tearing them down drops it with the session.
    terminateDecryptPool()
    clearStoredSession()
  }, [user])

  // A viewer holds a Firebase session too now, so presence of `user` no longer
  // says anything about privilege — only the role claim does.
  const isAuthenticated = !!user
  const isViewer = role === 'viewer'
  const isAdmin = !!user && role === 'admin'

  // A fresh object literal here re-renders every consumer in the app on any
  // state change, and hands each of them new function identities to depend on.
  const value = useMemo(() => ({
    user,
    isViewer,
    isAdmin,
    isAuthenticated,
    familyId,
    encryptionKey,
    memoryCardStyle,
    loading,
    keyLoading,
    firebaseReady,
    loginAsViewer,
    loginAsAdmin,
    signup,
    logout,
    setActiveFamilyId,
  }), [
    user, isViewer, isAdmin, isAuthenticated, familyId, encryptionKey,
    memoryCardStyle, loading, keyLoading, firebaseReady,
    loginAsViewer, loginAsAdmin, signup, logout, setActiveFamilyId,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

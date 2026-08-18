import { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updateProfile, signOut, setPersistence, browserLocalPersistence, browserSessionPersistence,
} from 'firebase/auth'
import { doc, getDoc, addDoc, collection, query, where, getDocs, serverTimestamp, updateDoc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import { generateSlug, isSlugAvailable } from '../utils/familySlug'
import { generateEncryptionKey, importEncryptionKey, clearDecryptedTextCache } from '../utils/encryption'
import { clearDecryptedMediaCache } from '../components/media/useDecryptedMedia'
import { terminateDecryptPool } from '../utils/decryptPool'
import { readStored, writeStored, clearStoredSession, setSessionOnly } from '../utils/authStorage'

const AuthContext = createContext(null)

const VALID_CARD_STYLES = ['modern', 'classic', 'polaroid']
const normalizeCardStyle = (value) => (VALID_CARD_STYLES.includes(value) ? value : 'modern')

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null) // Firebase user (admin)
  const [isViewer, setIsViewer] = useState(false)
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

  useEffect(() => {
    // A viewer has no Firebase account, so their session lives only in storage.
    const viewerSession = readStored('fh_viewer')
    if (viewerSession === 'true') {
      setIsViewer(true)
    }

    if (!auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      // If a Firebase session is restored but fh_familyId was cleared (e.g. logged out
      // on another tab), resolve it now so the key-loading effect can run.
      if (firebaseUser && !readStored('fh_familyId')) {
        await resolveFamilyId(firebaseUser.uid)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [resolveFamilyId])

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
  const loginAsViewer = useCallback(async (password, viewerFamilyId, { remember = true } = {}) => {
    if (!db) throw new Error('Firebase not configured — add env vars and reload')
    if (!viewerFamilyId) throw new Error('No family link provided')

    const familyDoc = await getDoc(doc(db, 'families', viewerFamilyId))
    if (!familyDoc.exists()) {
      throw new Error('Family not found')
    }

    const { sharedPassword } = familyDoc.data()
    if (!sharedPassword) {
      throw new Error('This family has not set a shared password yet')
    }

    // Loaded on demand: AuthContext is imported by App, so a static import puts
    // bcrypt in the startup bundle for every visitor, including the many who
    // never see a password field.
    const { default: bcrypt } = await import('bcryptjs')
    const isMatch = await bcrypt.compare(password, sharedPassword)
    if (!isMatch) {
      throw new Error('Invalid password')
    }

    // Chosen before the first write, so both values land in the same store.
    setSessionOnly(!remember)
    setIsViewer(true)
    setFamilyId(viewerFamilyId)
    writeStored('fh_viewer', 'true')
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
  }, [])

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
    setIsViewer(false)
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

  const isAuthenticated = !!user || isViewer
  const isAdmin = !!user

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

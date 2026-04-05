import { createContext, useContext, useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth'
import { doc, getDoc, addDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import bcrypt from 'bcryptjs'
import { generateSlug, isSlugAvailable } from '../utils/familySlug'
import { generateEncryptionKey, importEncryptionKey } from '../utils/encryption'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null) // Firebase user (admin)
  const [isViewer, setIsViewer] = useState(false)
  const [familyId, setFamilyId] = useState(() => localStorage.getItem('fh_familyId'))
  const [encryptionKey, setEncryptionKey] = useState(null)
  const [keyLoading, setKeyLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const firebaseReady = !!(auth && db)

  useEffect(() => {
    // Check localStorage for viewer session
    const viewerSession = localStorage.getItem('fh_viewer')
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
      if (firebaseUser && !localStorage.getItem('fh_familyId')) {
        await resolveFamilyId(firebaseUser.uid)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  // Load encryption key whenever familyId or auth state changes.
  // Depending on user ensures a retry when Firebase Auth is restored after the
  // initial mount, which fixes the race where familyId was set from localStorage
  // before the auth token was ready and the first Firestore read failed silently.
  useEffect(() => {
    if (!familyId || !db) return
    setKeyLoading(true)
    setEncryptionKey(null)
    async function loadKey() {
      try {
        const familyDoc = await getDoc(doc(db, 'families', familyId))
        if (familyDoc.exists()) {
          const data = familyDoc.data()
          if (data.encryptionKeyJwk) {
            const key = await importEncryptionKey(data.encryptionKeyJwk)
            setEncryptionKey(key)
          }
        }
      } catch (err) {
        console.error('Failed to load encryption key:', err)
      } finally {
        setKeyLoading(false)
      }
    }
    loadKey()
  }, [familyId, user])

  const resolveFamilyId = async (uid) => {
    const q = query(collection(db, 'families'), where('adminUid', '==', uid))
    const snapshot = await getDocs(q)
    if (snapshot.empty) return null
    const id = snapshot.docs[0].id
    setFamilyId(id)
    localStorage.setItem('fh_familyId', id)
    return id
  }

  const loginAsViewer = async (password, viewerFamilyId) => {
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

    const isMatch = await bcrypt.compare(password, sharedPassword)
    if (!isMatch) {
      throw new Error('Invalid password')
    }

    setIsViewer(true)
    setFamilyId(viewerFamilyId)
    localStorage.setItem('fh_viewer', 'true')
    localStorage.setItem('fh_familyId', viewerFamilyId)
  }

  const loginAsAdmin = async (email, password) => {
    if (!auth) throw new Error('Firebase not configured — add env vars and reload')
    const result = await signInWithEmailAndPassword(auth, email, password)
    await resolveFamilyId(result.user.uid)
  }

  const signup = async (email, password, displayName, familyName) => {
    if (!auth || !db) throw new Error('Firebase not configured — add env vars and reload')

    const name = familyName || displayName + "'s Family"
    const slug = generateSlug(name)
    if (!slug) throw new Error('Family name produces an invalid URL — please use letters or numbers')

    const available = await isSlugAvailable(slug)
    if (!available) throw new Error('This family name is already taken — please choose another')

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
      familyName: name,
      familySlug: slug,
      encryptionKeyJwk: jwk,
      createdAt: serverTimestamp(),
    })
    setFamilyId(familyRef.id)
    localStorage.setItem('fh_familyId', familyRef.id)
  }

  const logout = async () => {
    if (user && auth) {
      await signOut(auth)
    }
    setIsViewer(false)
    setFamilyId(null)
    setEncryptionKey(null)
    localStorage.removeItem('fh_viewer')
    localStorage.removeItem('fh_familyId')
  }

  const isAuthenticated = !!user || isViewer
  const isAdmin = !!user

  return (
    <AuthContext.Provider value={{
      user,
      isViewer,
      isAdmin,
      isAuthenticated,
      familyId,
      encryptionKey,
      loading,
      keyLoading,
      firebaseReady,
      loginAsViewer,
      loginAsAdmin,
      signup,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

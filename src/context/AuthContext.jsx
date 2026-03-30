import { createContext, useContext, useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth'
import { doc, getDoc, addDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import bcrypt from 'bcryptjs'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null) // Firebase user (admin)
  const [isViewer, setIsViewer] = useState(false)
  const [familyId, setFamilyId] = useState(() => localStorage.getItem('fh_familyId'))
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

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })

    return unsubscribe
  }, [])

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
    const result = await createUserWithEmailAndPassword(auth, email, password)
    if (displayName) {
      await updateProfile(result.user, { displayName })
    }
    // Create the family document
    const familyRef = await addDoc(collection(db, 'families'), {
      adminUid: result.user.uid,
      familyName: familyName || displayName + "'s Family",
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
      loading,
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

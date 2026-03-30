import { createContext, useContext, useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import bcrypt from 'bcryptjs'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null) // Firebase user (admin)
  const [isViewer, setIsViewer] = useState(false)
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

  const loginAsViewer = async (password) => {
    if (!db) throw new Error('Firebase not configured — add env vars and reload')

    const settingsDoc = await getDoc(doc(db, 'settings', 'access'))
    if (!settingsDoc.exists()) {
      throw new Error('Access settings not configured')
    }

    const { sharedPassword } = settingsDoc.data()
    const isMatch = await bcrypt.compare(password, sharedPassword)

    if (!isMatch) {
      throw new Error('Invalid password')
    }

    setIsViewer(true)
    localStorage.setItem('fh_viewer', 'true')
  }

  const loginAsAdmin = async (email, password) => {
    if (!auth) throw new Error('Firebase not configured — add env vars and reload')
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signup = async (email, password, displayName) => {
    if (!auth) throw new Error('Firebase not configured — add env vars and reload')
    const result = await createUserWithEmailAndPassword(auth, email, password)
    if (displayName) {
      await updateProfile(result.user, { displayName })
    }
  }

  const logout = async () => {
    if (user && auth) {
      await signOut(auth)
    }
    setIsViewer(false)
    localStorage.removeItem('fh_viewer')
  }

  const isAuthenticated = !!user || isViewer
  const isAdmin = !!user

  return (
    <AuthContext.Provider value={{
      user,
      isViewer,
      isAdmin,
      isAuthenticated,
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

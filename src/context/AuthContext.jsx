import { createContext, useContext, useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import bcrypt from 'bcryptjs'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null) // Firebase user (admin)
  const [isViewer, setIsViewer] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check localStorage for viewer session
    const viewerSession = localStorage.getItem('fh_viewer')
    if (viewerSession === 'true') {
      setIsViewer(true)
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const loginAsViewer = async (password) => {
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
    await signInWithEmailAndPassword(auth, email, password)
  }

  const logout = async () => {
    if (user) {
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
      loginAsViewer,
      loginAsAdmin,
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

import { createContext, useContext, useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth } from '../firebase'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [adminUser, setAdminUser] = useState(null)
  const [viewerToken, setViewerToken] = useState(() => localStorage.getItem('viewerToken'))
  const [loading, setLoading] = useState(true)

  const isViewer = !!viewerToken
  const isAdmin = !!adminUser
  const isAuthenticated = isViewer || isAdmin

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAdminUser(user)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!viewerToken) {
      setLoading(false)
      return
    }
    try {
      const payload = JSON.parse(atob(viewerToken.split('.')[1]))
      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('viewerToken')
        setViewerToken(null)
      }
    } catch {
      localStorage.removeItem('viewerToken')
      setViewerToken(null)
    }
  }, [viewerToken])

  async function loginViewer(password) {
    const res = await fetch('/api/verify-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Invalid password')
    localStorage.setItem('viewerToken', data.token)
    setViewerToken(data.token)
  }

  async function loginAdmin(email, password) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function logout() {
    if (adminUser) {
      await signOut(auth)
    }
    localStorage.removeItem('viewerToken')
    setViewerToken(null)
  }

  const value = {
    adminUser,
    viewerToken,
    isViewer,
    isAdmin,
    isAuthenticated,
    loading,
    loginViewer,
    loginAdmin,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

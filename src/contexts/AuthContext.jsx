import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth } from '../firebase'

const AuthContext = createContext(null)

const TOKEN_KEY = 'hearth_inner_token'

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null)
  const [innerCircleToken, setInnerCircleToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [authLoading, setAuthLoading] = useState(true)

  // Listen for Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user)
      setAuthLoading(false)
    })
    return unsubscribe
  }, [])

  const isAdmin = Boolean(firebaseUser)
  const isInnerCircle = Boolean(innerCircleToken)
  const isAuthenticated = isAdmin || isInnerCircle

  // Inner circle login — calls Vercel function
  const loginInnerCircle = useCallback(async (password) => {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Wrong password. Try again.')
    }
    const { token } = await res.json()
    localStorage.setItem(TOKEN_KEY, token)
    setInnerCircleToken(token)
  }, [])

  // Admin login — Firebase Auth
  const loginAdmin = useCallback(async (email, password) => {
    await signInWithEmailAndPassword(auth, email, password)
  }, [])

  // Logout both sessions
  const logout = useCallback(async () => {
    if (firebaseUser) await signOut(auth)
    localStorage.removeItem(TOKEN_KEY)
    setInnerCircleToken(null)
  }, [firebaseUser])

  // Get fresh Firebase ID token for admin API calls
  const getAdminToken = useCallback(async () => {
    if (!firebaseUser) throw new Error('Not authenticated as admin')
    return firebaseUser.getIdToken()
  }, [firebaseUser])

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        innerCircleToken,
        isAdmin,
        isInnerCircle,
        isAuthenticated,
        authLoading,
        loginInnerCircle,
        loginAdmin,
        logout,
        getAdminToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

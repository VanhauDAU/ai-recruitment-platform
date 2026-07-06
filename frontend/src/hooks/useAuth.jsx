import { createContext, useContext, useEffect, useState } from 'react'
import * as authService from '../api/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authService.getAccessToken()) {
      setLoading(false)
      return
    }
    authService
      .me()
      .then(setUser)
      .catch(() => authService.logout())
      .finally(() => setLoading(false))
  }, [])

  async function login(credentials) {
    await authService.login(credentials)
    const currentUser = await authService.me()
    setUser(currentUser)
    return currentUser
  }

  function logout() {
    authService.logout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

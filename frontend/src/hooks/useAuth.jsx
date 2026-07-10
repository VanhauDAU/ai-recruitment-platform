import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as authService from '../api/authService'
import { adminPath, employerAppPath, getCurrentPortal } from '../config/portals'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const loginPathForCurrentPortal = useCallback(() => {
    const portal = getCurrentPortal()
    if (portal === 'employer') return employerAppPath('/login')
    if (portal === 'admin') return adminPath('/login')
    return '/login'
  }, [])

  const logout = useCallback(() => {
    const portal = getCurrentPortal()
    authService.logout(portal)
    setUser(null)
    navigate(loginPathForCurrentPortal(), { replace: true })
  }, [loginPathForCurrentPortal, navigate])

  useEffect(() => {
    if (!authService.getAccessToken()) {
      setLoading(false)
      return
    }
    authService
      .me()
      .then(setUser)
      .catch(logout)
      .finally(() => setLoading(false))
  }, [logout])

  async function login(credentials) {
    await authService.login(credentials)
    const currentUser = await authService.me()
    setUser(currentUser)
    return currentUser
  }

  // Lấy lại thông tin user hiện tại (sau khi đăng ký auto-login, đổi email, xác thực...).
  async function refreshUser() {
    const currentUser = await authService.me()
    setUser(currentUser)
    return currentUser
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

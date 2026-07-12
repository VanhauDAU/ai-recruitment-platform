import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as authService from '../api/authService'
import { verifyTwoFactorLogin } from '@/features/two-factor'
import { adminPath, employerAppPath, getCurrentPortal } from '@/config/portals'
import AuthContext from './authContext'

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
    try {
      const result = await authService.login(credentials)
      if (result.two_factor_required) return result
      const currentUser = await authService.me()
      setUser(currentUser)
      return currentUser
    } catch (error) {
      authService.logout(credentials.portal)
      setUser(null)
      throw error
    }
  }

  async function completeTwoFactorLogin({ challenge, code, portal }) {
    await verifyTwoFactorLogin({ challenge, code, portal })
    const currentUser = await authService.me()
    setUser(currentUser)
    return currentUser
  }

  function setAuthenticatedUser(user) {
    setUser(user)
  }

  // Lấy lại thông tin user hiện tại (sau khi đăng ký auto-login, đổi email, xác thực...).
  async function refreshUser() {
    const currentUser = await authService.me()
    setUser(currentUser)
    return currentUser
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, setAuthenticatedUser, completeTwoFactorLogin, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminPath, employerAppPath, getCurrentPortal } from '@/shared/config/portals'
import { getCurrentSessionUser } from '../api/session.api'
import SessionContext from './session-context'
import { clearSession, getAccessToken } from './session.storage'

function loginPathForCurrentPortal() {
  const portal = getCurrentPortal()
  if (portal === 'employer') return employerAppPath('/login')
  if (portal === 'admin') return adminPath('/login')
  return '/login'
}

export default function SessionProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const clearCurrentSession = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  const logout = useCallback(() => {
    clearCurrentSession()
    navigate(loginPathForCurrentPortal(), { replace: true })
  }, [clearCurrentSession, navigate])

  const refreshSession = useCallback(async () => {
    try {
      const currentUser = await getCurrentSessionUser()
      setUser(currentUser)
      return currentUser
    } catch (error) {
      clearCurrentSession()
      throw error
    }
  }, [clearCurrentSession])

  const restoreSession = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null)
      setLoading(false)
      return null
    }

    try {
      return await refreshSession()
    } catch {
      clearCurrentSession()
      return null
    } finally {
      setLoading(false)
    }
  }, [clearCurrentSession, refreshSession])

  useEffect(() => {
    restoreSession()
  }, [restoreSession])

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      logout,
      refreshSession,
      restoreSession,
      setCurrentUser: setUser,
      clearCurrentSession,
    }),
    [user, loading, logout, refreshSession, restoreSession, clearCurrentSession],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

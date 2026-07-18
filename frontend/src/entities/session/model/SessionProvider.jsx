import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminPath, employerAppPath, getCurrentPortal } from '@/shared/config/portals'
import { getCurrentSessionUser } from '../api/session.api'
import SessionContext from './session-context'
import {
  clearSession,
  clearTokens,
  getAccessToken,
  subscribeToSessionLogout,
} from '@/shared/api/token-store'

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
  const queryClient = useQueryClient()

  const clearSessionState = useCallback(() => {
    setUser(null)
    // Cache server-state gắn với phiên cũ (saved jobs, CV...) phải bị bỏ.
    queryClient.clear()
  }, [queryClient])

  const clearCurrentSession = useCallback(() => {
    // Phiên hiện tại hỏng/hết hạn không được làm mất phiên hợp lệ ở portal khác.
    clearTokens()
    clearSessionState()
  }, [clearSessionState])

  const logout = useCallback(() => {
    clearSession()
    clearSessionState()
    navigate(loginPathForCurrentPortal(), { replace: true })
  }, [clearSessionState, navigate])

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

  useEffect(
    () => subscribeToSessionLogout(clearSessionState),
    [clearSessionState],
  )

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

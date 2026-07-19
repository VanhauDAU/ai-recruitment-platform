import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminPath, employerAppPath, getCurrentPortal } from '@/shared/config/portals'
import { getCurrentSessionUser, logoutAllDevices, logoutCurrentPortal } from '../api/session.api'
import SessionContext from './session-context'
import {
  clearAllPortalSessions,
  clearCurrentPortalSession,
  clearTokens,
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

  // Đăng xuất mặc định chỉ ảnh hưởng CỔNG HIỆN TẠI (khớp mô hình token đã tách):
  // blacklist refresh token phía server trước, rồi mới xóa phiên cục bộ.
  const logout = useCallback(async () => {
    let serverRevokeUncertain = false
    try {
      await logoutCurrentPortal()
    } catch {
      // Mạng lỗi vẫn phải xóa phiên cục bộ để người dùng thoát được.
      serverRevokeUncertain = true
    }
    clearCurrentPortalSession()
    clearSessionState()
    navigate(loginPathForCurrentPortal(), {
      replace: true,
      state: serverRevokeUncertain
        ? { authWarning: 'Đã đăng xuất trên thiết bị này; chưa thể xác nhận thu hồi phiên trên máy chủ.' }
        : undefined,
    })
  }, [clearSessionState, navigate])

  // Đăng xuất khỏi mọi thiết bị của cổng hiện tại (thu hồi toàn bộ refresh token).
  const logoutAllDevicesForPortal = useCallback(async () => {
    try {
      await logoutAllDevices()
    } catch {
      // Bỏ qua lỗi mạng: vẫn xóa phiên cục bộ bên dưới.
    }
    clearCurrentPortalSession()
    clearSessionState()
    navigate(loginPathForCurrentPortal(), { replace: true })
  }, [clearSessionState, navigate])

  // Đăng xuất khỏi TẤT CẢ cổng trên thiết bị này (hành động toàn cục, chủ động).
  const logoutAllPortalsOnThisBrowser = useCallback(async () => {
    await Promise.allSettled(['main', 'employer', 'admin'].map((portal) => logoutCurrentPortal(portal)))
    clearAllPortalSessions()
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
      logoutAllDevices: logoutAllDevicesForPortal,
      logoutAllPortalsOnThisBrowser,
      refreshSession,
      restoreSession,
      setCurrentUser: setUser,
      clearCurrentSession,
    }),
    [
      user,
      loading,
      logout,
      logoutAllDevicesForPortal,
      logoutAllPortalsOnThisBrowser,
      refreshSession,
      restoreSession,
      clearCurrentSession,
    ],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { adminPath, employerAppPath, getCurrentPortal } from '@/shared/config/portals'
import { getCurrentSessionUser, logoutAllDevices, logoutCurrentPortal } from '../api/session.api'
import SessionContext from './session-context'
import {
  clearAllPortalSessions,
  clearCurrentPortalSession,
  clearTokens,
  subscribeToSessionExpired,
  subscribeToSessionLogout,
  subscribeToPermissionDenied,
} from '@/shared/api/token-store'
import { message } from '@/shared/lib/toast'

const ADMIN_SESSION_REFRESH_INTERVAL_MS = 60_000
const PERMISSION_DENIED_COOLDOWN_MS = 5_000

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
  const lastRefreshAt = useRef(0)
  const permissionDeniedAt = useRef(0)
  // Khách vãng lai cũng gặp 401 khi lướt trang công khai; chỉ người ĐANG đăng
  // nhập mới bị đá về trang login.
  const loggedInRef = useRef(false)

  useEffect(() => {
    loggedInRef.current = Boolean(user)
  }, [user])

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
      lastRefreshAt.current = Date.now()
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

  // Refresh hỏng giữa chừng: dọn state và đưa về trang đăng nhập của cổng hiện
  // tại. Không có nhánh này thì guard vẫn thấy isAuthenticated=true và giữ người
  // dùng ở lại workspace trong khi mọi request đều 401.
  useEffect(() => subscribeToSessionExpired(() => {
    if (!loggedInRef.current) return
    clearSessionState()
    message.warning('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
    navigate(loginPathForCurrentPortal(), { replace: true })
  }), [clearSessionState, navigate])

  useEffect(() => subscribeToPermissionDenied(() => {
    const now = Date.now()
    if (
      getCurrentPortal() !== 'admin'
      || now - permissionDeniedAt.current < PERMISSION_DENIED_COOLDOWN_MS
    ) return
    permissionDeniedAt.current = now
    message.warning('Quyền truy cập vừa thay đổi. Hệ thống đang cập nhật phiên của bạn.')
    refreshSession().catch(() => {})
  }), [refreshSession])

  useEffect(() => {
    if (getCurrentPortal() !== 'admin') return undefined

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshSession().catch(() => {})
    }, ADMIN_SESSION_REFRESH_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [refreshSession])

  useEffect(() => {
    function refreshVisibleAdminSession() {
      if (
        document.visibilityState !== 'visible'
        || getCurrentPortal() !== 'admin'
        || Date.now() - lastRefreshAt.current <= ADMIN_SESSION_REFRESH_INTERVAL_MS
      ) return
      refreshSession().catch(() => {})
    }
    document.addEventListener('visibilitychange', refreshVisibleAdminSession)
    return () => document.removeEventListener(
      'visibilitychange',
      refreshVisibleAdminSession,
    )
  }, [refreshSession])

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

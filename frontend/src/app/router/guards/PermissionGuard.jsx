import { useEffect, useRef, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import {
  canAccessAdminRoute,
  createAdminAccess,
  useAdminAccess,
} from '@/entities/admin-access'
import { useSession } from '@/entities/session'
import { adminPath } from '@/shared/config/portals'
import PageLoading from '@/shared/ui/PageLoading'

export default function PermissionGuard({ route, children }) {
  const { user, refreshSession } = useSession()
  const adminAccess = useAdminAccess(user)
  const attemptedRefresh = useRef(false)
  const [decision, setDecision] = useState(() => (
    canAccessAdminRoute(route, adminAccess) ? 'allow' : 'checking'
  ))

  useEffect(() => {
    if (canAccessAdminRoute(route, adminAccess)) {
      setDecision('allow')
      return
    }
    if (attemptedRefresh.current) return
    attemptedRefresh.current = true
    refreshSession()
      .then((currentUser) => {
        setDecision(
          canAccessAdminRoute(route, createAdminAccess(currentUser))
            ? 'allow'
            : 'deny',
        )
      })
      .catch(() => setDecision('deny'))
  }, [adminAccess, refreshSession, route])

  if (decision === 'checking') return <PageLoading />
  if (decision === 'deny') {
    return <Navigate to={adminPath('/access-denied')} replace />
  }
  return children || <Outlet />
}

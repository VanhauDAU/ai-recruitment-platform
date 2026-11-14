import { useMemo } from 'react'

export function createAdminAccess(user) {
  return { isSuperuser: Boolean(user?.admin_access?.is_superuser) }
}

export function useAdminAccess(user) {
  return useMemo(() => createAdminAccess(user), [user])
}

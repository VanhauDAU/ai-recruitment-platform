import { useMemo } from 'react'

export function createAdminAccess(user) {
  const snapshot = user?.admin_access
  const isSuperuser = Boolean(snapshot?.is_superuser)
  const permissions = new Set(snapshot?.permissions || [])
  const has = (code) => isSuperuser || permissions.has(code)
  return {
    isSuperuser,
    permissions,
    has,
    hasAny: (codes) => codes.some(has),
    hasAll: (codes) => codes.every(has),
    memberships: snapshot?.memberships || [],
    primaryDepartment: snapshot?.primary_department || null,
  }
}

export function useAdminAccess(user) {
  return useMemo(() => createAdminAccess(user), [user])
}

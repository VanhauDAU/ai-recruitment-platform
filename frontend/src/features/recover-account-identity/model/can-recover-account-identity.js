export function canRecoverAccountIdentity({
  hasPermission,
  isSuperuser,
  permission,
  targetRole,
}) {
  if (isSuperuser) return true
  return targetRole !== 'admin' && hasPermission(permission)
}

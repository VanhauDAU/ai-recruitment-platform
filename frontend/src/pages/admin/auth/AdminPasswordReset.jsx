import { PasswordResetForm } from '@/features/common/account/auth'
import { adminPath } from '@/shared/config/portals'

export default function AdminPasswordReset() {
  return (
    <PasswordResetForm
      portal="admin"
      requestPath={adminPath('/login')}
      invalidActionLabel="Quay về đăng nhập"
    />
  )
}

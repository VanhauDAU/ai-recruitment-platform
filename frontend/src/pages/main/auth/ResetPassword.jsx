import { PasswordResetForm } from '@/features/common/account/auth'

export default function ResetPassword({ requestPath = '/quen-mat-khau' }) {
  return <PasswordResetForm requestPath={requestPath} />
}

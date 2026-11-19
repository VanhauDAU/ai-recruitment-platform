import { PasswordResetForm } from '@/features/common/account/auth'

export default function ResetPassword({ requestPath = '/forgot-password' }) {
  return <PasswordResetForm requestPath={requestPath} />
}

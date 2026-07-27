import { PasswordResetForm } from '@/features/auth'

export default function ResetPassword({ requestPath = '/forgot-password' }) {
  return <PasswordResetForm requestPath={requestPath} />
}

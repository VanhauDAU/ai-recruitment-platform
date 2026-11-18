import { Divider } from 'antd'
import { useSearchParams } from 'react-router'
import { getReturnUrl, startOAuthReauth } from '@/features/common/account/auth'
import { ChangePasswordForm } from '@/features/common/account/change-password'
import { SessionManager } from '@/features/common/account/session-management'
import { EMPLOYER_PHONE_VERIFY_URL } from '@/shared/config/portals'
import { EmployerAccountSettingsShell } from '@/widgets/employer/account-settings'

export default function EmployerPasswordLogin() {
  const [searchParams] = useSearchParams()
  const requestedReturnUrl = getReturnUrl(searchParams)
  const successRedirect = requestedReturnUrl === EMPLOYER_PHONE_VERIFY_URL
    ? requestedReturnUrl
    : undefined

  return (
    <EmployerAccountSettingsShell
      title="Thay đổi mật khẩu"
      description="Tạo mật khẩu cho tài khoản Google hoặc cập nhật mật khẩu đăng nhập, và quản lý thiết bị đang đăng nhập."
    >
      <ChangePasswordForm successRedirect={successRedirect} onReauth={startOAuthReauth} />
      <Divider className="!my-8" />
      <SessionManager />
    </EmployerAccountSettingsShell>
  )
}

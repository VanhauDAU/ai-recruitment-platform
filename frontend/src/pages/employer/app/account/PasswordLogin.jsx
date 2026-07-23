import { Divider } from 'antd'
import { ChangePasswordForm } from '@/features/change-password'
import { SessionManager } from '@/features/session-management'
import { employerAppPath, EMPLOYER_PHONE_VERIFY_URL } from '@/shared/config/portals'
import { EmployerAccountSettingsShell } from '@/widgets/employer-account-settings'

export default function EmployerPasswordLogin() {
  return (
    <EmployerAccountSettingsShell
      title="Thay đổi mật khẩu"
      description="Tạo mật khẩu cho tài khoản Google hoặc cập nhật mật khẩu đăng nhập, và quản lý thiết bị đang đăng nhập."
    >
      <ChangePasswordForm
        successRedirect={EMPLOYER_PHONE_VERIFY_URL}
        reauthPath={employerAppPath('/login')}
      />
      <Divider className="!my-8" />
      <SessionManager />
    </EmployerAccountSettingsShell>
  )
}

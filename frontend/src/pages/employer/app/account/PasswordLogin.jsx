import { Divider } from 'antd'
import { ChangePasswordForm } from '@/features/change-password'
import { SessionManager } from '@/features/session-management'
import { EmployerAccountSettingsShell } from '@/widgets/employer-account-settings'

export default function EmployerPasswordLogin() {
  return (
    <EmployerAccountSettingsShell
      title="Mật khẩu & bảo mật"
      description="Tạo mật khẩu cho tài khoản Google hoặc cập nhật mật khẩu đăng nhập, và quản lý thiết bị đang đăng nhập."
    >
      <ChangePasswordForm />
      <Divider className="!my-8" />
      <SessionManager />
    </EmployerAccountSettingsShell>
  )
}

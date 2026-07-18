import { ChangePasswordForm } from '@/features/change-password'
import { EmployerAccountSettingsShell } from '@/widgets/employer-account-settings'

export default function EmployerPasswordLogin() {
  return <EmployerAccountSettingsShell title="Thay đổi mật khẩu" description="Tạo mật khẩu cho tài khoản Google hoặc cập nhật mật khẩu đăng nhập hiện tại."><ChangePasswordForm /></EmployerAccountSettingsShell>
}

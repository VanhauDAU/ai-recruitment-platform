import { EmployerAccountSettingsShell, EmployerGeneralSettings } from '@/widgets/employer-account-settings'

export default function EmployerGeneralSettingsPage() {
  return (
    <EmployerAccountSettingsShell
      title="Cài đặt"
      description="Quản lý thông báo và các phương thức xác thực bảo mật cho tài khoản tuyển dụng của bạn."
    >
      <EmployerGeneralSettings />
    </EmployerAccountSettingsShell>
  )
}

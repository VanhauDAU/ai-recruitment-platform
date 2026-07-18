import { EmployerAccountInformation, EmployerAccountSettingsShell } from '@/widgets/employer-account-settings'

export default function EmployerAccountInformationPage() {
  return (
    <EmployerAccountSettingsShell
      title="Thông tin tài khoản"
      description="Cập nhật thông tin liên hệ và quản lý hồ sơ tài khoản tuyển dụng của bạn."
    >
      <EmployerAccountInformation />
    </EmployerAccountSettingsShell>
  )
}

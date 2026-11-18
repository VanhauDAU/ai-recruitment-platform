import { EmployerBusinessLicenseForm } from '@/features/employer/account/verify-employer-account'
import { EmployerAccountSettingsShell } from '@/widgets/employer/account-settings'

export default function EmployerBusinessLicense() {
  return <EmployerAccountSettingsShell title="Giấy đăng ký doanh nghiệp"><EmployerBusinessLicenseForm /></EmployerAccountSettingsShell>
}

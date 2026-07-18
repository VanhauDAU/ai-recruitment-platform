import { EmployerDataProtectionForm } from '@/features/verify-employer-account'
import { EmployerAccountSettingsShell } from '@/widgets/employer-account-settings'

export default function EmployerPersonalDataProtection() {
  return <EmployerAccountSettingsShell title="Văn bản xử lý Dữ liệu cá nhân" description="Hoàn thiện riêng văn bản với ứng viên và thỏa thuận với nền tảng."><EmployerDataProtectionForm /></EmployerAccountSettingsShell>
}

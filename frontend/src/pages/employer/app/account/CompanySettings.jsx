import { EmployerCompanySettings } from '@/features/manage-employer-company'
import { EmployerAccountSettingsShell } from '@/widgets/employer-account-settings'

export default function EmployerCompanySettingsPage() {
  return <EmployerAccountSettingsShell title="Cập nhật thông tin công ty" description="Tìm doanh nghiệp đã có trên hệ thống hoặc tạo hồ sơ công ty mới."><EmployerCompanySettings /></EmployerAccountSettingsShell>
}

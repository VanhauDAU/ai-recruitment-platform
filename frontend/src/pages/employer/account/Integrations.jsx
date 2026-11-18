import { SocialConnectionsPanel } from '@/features/employer/account/connect-social-account'
import { EmployerAccountSettingsShell } from '@/widgets/employer/account-settings'

export default function EmployerIntegrationsPage() {
  return (
    <EmployerAccountSettingsShell
      title="Kết nối mạng xã hội"
      description="Kết nối Fanpage để chiến dịch tự đăng bài tuyển dụng."
    >
      <SocialConnectionsPanel />
    </EmployerAccountSettingsShell>
  )
}

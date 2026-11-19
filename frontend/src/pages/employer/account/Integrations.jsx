import { SocialConnectionsPanel } from '@/features/employer/account/connect-social-account'
import { EmployerAccountSettingsShell } from '@/widgets/employer/account-settings'
import { m } from '@/shared/config/i18n'

export default function EmployerIntegrationsPage() {
  return (
    <EmployerAccountSettingsShell
      title={m.employer_account_settings_nav_integrations()}
      description={m.employer_account_page_integrations_desc()}
    >
      <SocialConnectionsPanel />
    </EmployerAccountSettingsShell>
  )
}

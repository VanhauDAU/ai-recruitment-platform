import { EmployerAccountSettingsShell, EmployerGeneralSettings } from '@/widgets/employer/account-settings'
import { m } from '@/shared/config/i18n'

export default function EmployerGeneralSettingsPage() {
  return (
    <EmployerAccountSettingsShell
      title={m.employer_account_settings_nav_general()}
      description={m.employer_account_page_general_desc()}
    >
      <EmployerGeneralSettings />
    </EmployerAccountSettingsShell>
  )
}

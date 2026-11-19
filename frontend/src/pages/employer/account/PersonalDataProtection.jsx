import { EmployerDataProtectionForm } from '@/features/employer/account/verify-employer-account'
import { EmployerAccountSettingsShell } from '@/widgets/employer/account-settings'
import { m } from '@/shared/config/i18n'

export default function EmployerPersonalDataProtection() {
  return <EmployerAccountSettingsShell title={m.employer_account_settings_nav_dpa()} description={m.employer_account_page_dpa_desc()}><EmployerDataProtectionForm /></EmployerAccountSettingsShell>
}

import { EmployerBusinessLicenseForm } from '@/features/employer/account/verify-employer-account'
import { EmployerAccountSettingsShell } from '@/widgets/employer/account-settings'
import { m } from '@/shared/config/i18n'

export default function EmployerBusinessLicense() {
  return <EmployerAccountSettingsShell title={m.employer_account_docs_business_registration()}><EmployerBusinessLicenseForm /></EmployerAccountSettingsShell>
}

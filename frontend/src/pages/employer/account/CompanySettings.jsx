import { EmployerCompanySettings } from '@/features/employer/company/manage-employer-company'
import { EmployerAccountSettingsShell } from '@/widgets/employer/account-settings'
import { m } from '@/shared/config/i18n'

export default function EmployerCompanySettingsPage() {
  return <EmployerAccountSettingsShell title={m.employer_account_checklist_company_title()} description={m.employer_account_page_company_desc()}><EmployerCompanySettings /></EmployerAccountSettingsShell>
}

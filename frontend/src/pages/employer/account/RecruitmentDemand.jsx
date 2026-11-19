import { RecruitmentDemandManager } from '@/features/employer/marketing/manage-employer-recruitment-needs'
import { EmployerAccountSettingsShell } from '@/widgets/employer/account-settings'
import { m } from '@/shared/config/i18n'

export default function EmployerRecruitmentDemand() {
  return <EmployerAccountSettingsShell title={m.employer_account_settings_nav_demand()}><RecruitmentDemandManager /></EmployerAccountSettingsShell>
}

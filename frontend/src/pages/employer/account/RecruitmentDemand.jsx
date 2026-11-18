import { RecruitmentDemandManager } from '@/features/employer/marketing/manage-employer-recruitment-needs'
import { EmployerAccountSettingsShell } from '@/widgets/employer/account-settings'

export default function EmployerRecruitmentDemand() {
  return <EmployerAccountSettingsShell title="Nhu cầu tuyển dụng"><RecruitmentDemandManager /></EmployerAccountSettingsShell>
}

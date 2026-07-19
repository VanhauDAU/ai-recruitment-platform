import { RecruitmentDemandManager } from '@/features/manage-employer-recruitment-needs'
import { EmployerAccountSettingsShell } from '@/widgets/employer-account-settings'

export default function EmployerRecruitmentDemand() {
  return <EmployerAccountSettingsShell title="Nhu cầu tuyển dụng"><RecruitmentDemandManager /></EmployerAccountSettingsShell>
}

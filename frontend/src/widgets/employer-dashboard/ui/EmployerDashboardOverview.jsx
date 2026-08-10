import { ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Skeleton } from 'antd'
import { getEmployerDashboard } from '@/entities/employer-dashboard'
import {
  EMPLOYER_CAPABILITIES,
  EmployerReadinessGateState,
  employerReadinessAction,
  employerReadinessBlockersFor,
  useEmployerReadiness,
} from '@/entities/employer-profile'
import { useSession } from '@/entities/session'
import { employerAppPath } from '@/shared/config/portals'
import ApplicationActivityCard from './ApplicationActivityCard'
import DashboardHeader from './DashboardHeader'
import DashboardSidebar from './DashboardSidebar'
import DashboardSummaryCards from './DashboardSummaryCards'
import {
  DashboardComplianceNotice,
  DashboardVerificationJourney,
} from './DashboardWelcomeSections'
import { RecentApplicationsCard, RecentJobsCard } from './RecentRecruitmentCards'
import RecruitmentPipelineCard from './RecruitmentPipelineCard'

export default function EmployerDashboardOverview() {
  const { user } = useSession()
  const dashboardQuery = useQuery({ queryKey: ['employer-dashboard'], queryFn: getEmployerDashboard })
  const {
    readiness,
    profileQuery,
    isChecking: readinessChecking,
    isAccessError: readinessError,
    canAccessCandidateData,
  } = useEmployerReadiness()

  if (dashboardQuery.isLoading) {
    return <div className="space-y-5"><Skeleton active paragraph={{ rows: 3 }} /><div className="grid gap-5 lg:grid-cols-3"><Skeleton active paragraph={{ rows: 12 }} className="lg:col-span-2" /><Skeleton active paragraph={{ rows: 12 }} /></div></div>
  }
  if (dashboardQuery.isError) {
    return (
      <Alert
        type="error"
        showIcon
        title="Không thể tải dashboard nhà tuyển dụng."
        description="Vui lòng kiểm tra kết nối và thử lại."
        action={<Button icon={<ReloadOutlined />} onClick={() => dashboardQuery.refetch()}>Thử lại</Button>}
      />
    )
  }

  const data = dashboardQuery.data || {}
  const account = data.account || {}
  const verification = account.verification || {}
  const summary = data.summary || {}
  const displayName = user?.full_name || user?.email || 'Nhà tuyển dụng'
  const candidateBlocker = employerReadinessBlockersFor(
    readiness,
    EMPLOYER_CAPABILITIES.CANDIDATE_DATA,
  )[0]
  const jobBlocker = employerReadinessBlockersFor(
    readiness,
    EMPLOYER_CAPABILITIES.JOB_WORKSPACE,
  )[0]
  const candidateActionTarget = canAccessCandidateData
    ? employerAppPath('/applications')
    : employerReadinessAction(candidateBlocker?.action).to
  const jobWorkspaceReady = !readinessChecking && !readinessError && readiness.jobWorkspaceReady
  const jobActionTarget = jobWorkspaceReady
    ? employerAppPath('/jobs/new')
    : employerReadinessAction(jobBlocker?.action).to

  return (
    <div className="space-y-5 pb-6 pt-3 sm:pt-5 xl:pt-6">
      <DashboardHeader
        displayName={displayName}
        account={account}
        jobActionTarget={jobActionTarget}
        candidateActionTarget={candidateActionTarget}
      />
      <DashboardComplianceNotice readiness={readiness} />

      <DashboardSummaryCards summary={summary} />

      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,.7fr)]">
        <ApplicationActivityCard activity={data.application_activity || []} />
        <RecruitmentPipelineCard summary={summary} />
      </div>

      <DashboardVerificationJourney
        verification={verification}
        jobWorkspaceReady={jobWorkspaceReady}
        hasPassword={Boolean(user?.has_usable_password)}
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
        <div className="space-y-5">
          <RecentJobsCard jobs={data.recent_jobs || []} />
          {canAccessCandidateData ? (
            <RecentApplicationsCard applications={data.recent_applications || []} />
          ) : (
            <EmployerReadinessGateState
              compact
              capability={EMPLOYER_CAPABILITIES.CANDIDATE_DATA}
              checking={readinessChecking}
              error={readinessError}
              readiness={readiness}
              onRetry={profileQuery.refetch}
            />
          )}
        </div>
        <DashboardSidebar
          account={account}
          recruitmentNeed={data.recruitment_need}
          summary={summary}
          candidateActionTarget={candidateActionTarget}
          jobWorkspaceReady={jobWorkspaceReady}
        />
      </div>
    </div>
  )
}

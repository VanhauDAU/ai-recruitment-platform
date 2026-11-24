import { ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Skeleton } from 'antd'
import { getEmployerDashboard } from '@/entities/dashboard/employer-dashboard'
import {
  EMPLOYER_CAPABILITIES,
  EmployerReadinessGateState,
  employerReadinessAction,
  employerReadinessBlockersFor,
  useEmployerReadiness,
} from '@/entities/account/employer-profile'
import { useSession } from '@/entities/account/session'
import { EmployerVerificationLifecycleAlert } from '@/features/employer/account/verify-employer-account'
import { employerAppPath } from '@/shared/config/portals'
import { m } from '@/shared/config/i18n'
import ApplicationActivityCard from './ApplicationActivityCard'
import DashboardHeader from './DashboardHeader'
import DashboardSidebar from './DashboardSidebar'
import DashboardSummaryCards from './DashboardSummaryCards'
import FlashBadgeProgressCard from './FlashBadgeProgressCard'
import {
  DashboardComplianceNotice,
  DashboardVerificationJourney,
} from './DashboardWelcomeSections'
import { RecentApplicationsCard, RecentJobsCard } from './RecentRecruitmentCards'
import RecruitmentPipelineCard from './RecruitmentPipelineCard'
import './employer-dashboard.css'

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
        title={m.employer_workspace_dash_load_error()}
        description={m.employer_workspace_check_connection()}
        action={<Button icon={<ReloadOutlined />} onClick={() => dashboardQuery.refetch()}>{m.employer_workspace_retry()}</Button>}
      />
    )
  }

  const data = dashboardQuery.data || {}
  const account = data.account || {}
  const verification = account.verification || {}
  const summary = data.summary || {}
  const displayName = user?.full_name || user?.email || m.employer_workspace_employer_fallback_name()
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
      <EmployerVerificationLifecycleAlert
        verificationCase={{ status: account.recruiter_verification_status }}
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
        <div className="space-y-5">
          <FlashBadgeProgressCard badge={data.flash_badge} />
          <DashboardSidebar
            account={account}
            recruitmentNeed={data.recruitment_need}
            summary={summary}
            candidateActionTarget={candidateActionTarget}
            jobWorkspaceReady={jobWorkspaceReady}
          />
        </div>
      </div>
    </div>
  )
}

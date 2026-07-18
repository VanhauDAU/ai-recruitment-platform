import { ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Skeleton } from 'antd'
import { getEmployerDashboard } from '@/entities/employer-dashboard'
import { useSession } from '@/entities/session'
import ApplicationActivityCard from './ApplicationActivityCard'
import DashboardSidebar from './DashboardSidebar'
import DashboardSummaryCards from './DashboardSummaryCards'
import {
  DashboardComplianceNotice,
  DashboardDiscovery,
  DashboardPromotionGrid,
  DashboardVerificationJourney,
  RecommendedCandidatesPromo,
} from './DashboardWelcomeSections'
import { RecentApplicationsCard, RecentJobsCard } from './RecentRecruitmentCards'

export default function EmployerDashboardOverview() {
  const { user } = useSession()
  const dashboardQuery = useQuery({ queryKey: ['employer-dashboard'], queryFn: getEmployerDashboard })

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
  const displayName = user?.full_name || user?.email || 'Nhà tuyển dụng'

  return (
    <div className="space-y-4">
      <DashboardComplianceNotice verification={verification} />
      <DashboardPromotionGrid />
      <DashboardVerificationJourney
        verification={verification}
        displayName={displayName}
        hasPassword={Boolean(user?.has_usable_password)}
      />
      <DashboardDiscovery />
      <RecommendedCandidatesPromo />

      <DashboardSummaryCards summary={data.summary} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <ApplicationActivityCard activity={data.application_activity || []} summary={data.summary} />
          <RecentJobsCard jobs={data.recent_jobs || []} />
          <RecentApplicationsCard applications={data.recent_applications || []} />
        </div>
        <DashboardSidebar account={account} recruitmentNeed={data.recruitment_need} />
      </div>
    </div>
  )
}

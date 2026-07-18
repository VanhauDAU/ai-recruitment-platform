import { InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Skeleton } from 'antd'
import { Link } from 'react-router-dom'
import { getEmployerDashboard } from '@/entities/employer-dashboard'
import { useSession } from '@/entities/session'
import { employerAppPath } from '@/shared/config/portals'
import ApplicationActivityCard from './ApplicationActivityCard'
import DashboardSidebar from './DashboardSidebar'
import DashboardSummaryCards from './DashboardSummaryCards'
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
  const displayName = user?.full_name || user?.email

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl bg-[linear-gradient(120deg,#12324a_0%,#0a5b4b_62%,#00a856_130%)] px-6 py-7 text-white shadow-sm sm:px-8">
        <span className="absolute -right-16 -top-28 h-72 w-72 rounded-full border-[38px] border-white/5" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div><p className="text-sm font-semibold text-emerald-200">Bảng tin tuyển dụng</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">Chào {displayName}, một ngày làm việc hiệu quả!</h1><p className="mt-2 text-sm text-white/65">Theo dõi hiệu suất tuyển dụng và những việc cần ưu tiên tại {account.company_name || 'doanh nghiệp của bạn'}.</p></div>
          <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-right backdrop-blur"><span className="block text-xs text-white/60">Tin đang tuyển</span><strong className="text-2xl">{data.summary?.jobs_active || 0}</strong></div>
        </div>
      </section>

      {!verification.dpa_accepted && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <InfoCircleOutlined className="text-blue-600" />
          <span className="min-w-0 flex-1">Hoàn thiện thỏa thuận xử lý dữ liệu để tăng mức độ an toàn cho hồ sơ ứng viên.</span>
          <Link to={employerAppPath('/employer-verify')} className="font-bold text-blue-700 hover:underline">Cập nhật ngay</Link>
        </div>
      )}

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

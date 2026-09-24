import { ToolOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Skeleton } from 'antd'
import { getJobPostingContext, jobKeys } from '@/entities/job'
import { EmployerServicesOverview } from '@/features/manage-job-services'

export default function EmployerMyServices() {
  const contextQuery = useQuery({
    queryKey: jobKeys.postingContext,
    queryFn: getJobPostingContext,
  })

  if (contextQuery.isLoading) return <Skeleton active paragraph={{ rows: 10 }} />
  if (contextQuery.isError) {
    return <Alert type="error" showIcon title="Không thể tải chính sách dịch vụ của doanh nghiệp." />
  }
  const services = contextQuery.data?.services || {}

  return (
    <section className="space-y-4 pb-8 pt-3">
      <header className="overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-700 to-teal-600 p-5 text-white shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-2xl"><ToolOutlined /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">Kho quyền lợi doanh nghiệp</p>
            <h1 className="mt-1 text-2xl font-black">Dịch vụ của tôi</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-emerald-50">Theo dõi dịch vụ đang chạy, quyền lợi còn lại và hiệu quả được ghi nhận trên các tin do bạn phụ trách.</p>
          </div>
        </div>
      </header>
      <EmployerServicesOverview
        activationEnabled={services.activation_enabled === true}
        refreshEnabled={services.refresh_enabled === true}
        alertEnabled={services.alert_enabled === true}
        metricsEnabled={services.metrics_enabled === true}
      />
    </section>
  )
}

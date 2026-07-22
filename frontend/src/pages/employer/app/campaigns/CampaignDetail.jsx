import {
  ArrowLeftOutlined,
  FileAddOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Empty, Skeleton } from 'antd'
import { useMemo } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  campaignKeys,
  getCampaign,
  getCampaignReport,
} from '@/entities/campaign'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import CampaignApplyCvPanel from './CampaignApplyCvPanel'
import CampaignJobsPanel from './CampaignJobsPanel'

const CONNECTED_STATUSES = new Set(['considering', 'shortlisted', 'interviewed', 'accepted'])

const CAMPAIGN_TABS = [
  { key: 'apply_cv', label: 'CV ứng tuyển' },
  { key: 'viewed_job', label: 'Ứng viên đã xem tin' },
  { key: 'cv_recommendation', label: 'CV đề xuất' },
  { key: 'paid_cv', label: 'CV tìm kiếm' },
  { key: 'followed_cv', label: 'CV đang theo dõi' },
  { key: 'upload_cv', label: 'Tải CV lên', icon: UploadOutlined, iconOnly: true },
  { key: 'job', label: 'Tin tuyển dụng' },
  { key: 'service', label: 'Dịch vụ' },
  { key: 'label', label: 'Nhãn' },
]

const LEGACY_TAB_MAP = {
  applications: 'apply_cv',
  overview: 'apply_cv',
  jobs: 'job',
}

const METRIC_STYLES = [
  { value: 'text-slate-800', border: 'border-t-slate-700' },
  { value: 'text-sky-600', border: 'border-t-sky-500' },
  { value: 'text-emerald-600', border: 'border-t-emerald-500' },
  { value: 'text-amber-500', border: 'border-t-amber-400' },
]

function numeric(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function optimizationScore(campaign, report) {
  if (campaign?.optimization_score != null) return numeric(campaign.optimization_score)
  const checks = [
    Boolean(campaign?.name?.trim()),
    Boolean(campaign?.status),
    numeric(campaign?.job_count ?? report?.jobs?.total) > 0,
    numeric(report?.headcount_target) > 0,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

function CampaignMetric({ label, value, index }) {
  const styles = METRIC_STYLES[index]
  return (
    <article className={`border border-slate-200 border-t-2 bg-white px-5 py-4 ${styles.border}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <strong className={`mt-2 block text-2xl leading-none ${styles.value}`}>{numeric(value).toLocaleString('vi-VN')}</strong>
    </article>
  )
}

function EmptyTab({ label }) {
  return (
    <Empty
      className="py-20"
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={(
        <div>
          <p className="font-medium text-slate-600">Chưa có dữ liệu {label.toLocaleLowerCase('vi-VN')}</p>
          <p className="mt-1 text-xs text-slate-400">Dữ liệu sẽ hiển thị tại đây khi phát sinh.</p>
        </div>
      )}
    />
  )
}

export default function CampaignDetail() {
  const navigate = useNavigate()
  const { publicId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const campaignQuery = useQuery({
    queryKey: campaignKeys.detail(publicId),
    queryFn: () => getCampaign(publicId),
    enabled: Boolean(publicId),
  })
  const reportQuery = useQuery({
    queryKey: campaignKeys.report(publicId),
    queryFn: () => getCampaignReport(publicId),
    enabled: Boolean(publicId),
  })

  const requestedTab = searchParams.get('active_tab') || searchParams.get('tab') || 'apply_cv'
  const normalizedTab = LEGACY_TAB_MAP[requestedTab] || requestedTab
  const activeTab = CAMPAIGN_TABS.some((tab) => tab.key === normalizedTab) ? normalizedTab : 'apply_cv'
  const campaign = campaignQuery.data
  const report = reportQuery.data || {}
  const connectedCount = useMemo(() => Object.entries(report.funnel || {})
    .filter(([status]) => CONNECTED_STATUSES.has(status))
    .reduce((total, [, count]) => total + numeric(count), 0), [report.funnel])
  const totalApplications = report.applications?.total ?? campaign?.application_count ?? 0
  const metrics = [
    { label: 'Tổng lượng CV ứng viên', value: totalApplications },
    { label: 'CV ứng tuyển', value: totalApplications },
    { label: 'CV đã kết nối', value: connectedCount },
    { label: 'Số credit đã sử dụng', value: report.credits_used ?? campaign?.credits_used ?? 0 },
  ]

  const selectTab = (key) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('tab')
    nextParams.set('active_tab', key)
    setSearchParams(nextParams)
  }

  if (campaignQuery.isLoading) {
    return <Skeleton active className="bg-white p-6" paragraph={{ rows: 10 }} />
  }

  if (campaignQuery.isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Không thể tải chi tiết chiến dịch"
        description={getApiErrorMessage(campaignQuery.error, 'Vui lòng thử lại sau.')}
        action={<button type="button" className="font-semibold text-red-700" onClick={() => campaignQuery.refetch()}>Thử lại</button>}
      />
    )
  }

  const activeTabLabel = CAMPAIGN_TABS.find((tab) => tab.key === activeTab)?.label || ''

  return (
    <section className="-mx-3 -mt-4 pb-5 sm:-mx-4 lg:-mx-5">
      <header className="flex min-h-16 flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded bg-slate-100 px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
            onClick={() => navigate('/tuyendung/app/campaigns')}
          >
            <ArrowLeftOutlined /> Quay lại
          </button>
          <h1 className="truncate text-lg font-bold text-slate-800" title={campaign?.name}>{campaign?.name || 'Chiến dịch tuyển dụng'}</h1>
        </div>
        <span className="inline-flex h-9 shrink-0 items-center justify-center self-start rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-600 sm:self-auto">
          Điểm tối ưu: <strong className="ml-1 text-emerald-600">{optimizationScore(campaign, report)}%</strong>
        </span>
      </header>

      <div className="space-y-3 px-3 pt-4 sm:px-4 lg:px-5">
        {reportQuery.isError && (
          <Alert type="warning" showIcon message="Một số chỉ số chiến dịch chưa tải được." closable />
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map((metric, index) => <CampaignMetric key={metric.label} {...metric} index={index} />)}
        </div>

        <section className="min-w-0 border border-slate-200 bg-white">
          <div className="overflow-x-auto border-b border-slate-200">
            <div role="tablist" aria-label="Nội dung chiến dịch" className="flex min-w-max items-stretch px-2">
              {CAMPAIGN_TABS.map((tab) => {
                const Icon = tab.icon
                const selected = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-label={tab.iconOnly ? tab.label : undefined}
                    title={tab.iconOnly ? tab.label : undefined}
                    className={`relative flex h-14 items-center justify-center whitespace-nowrap px-3 text-sm font-medium transition-colors ${selected ? 'text-slate-900' : 'text-slate-500 hover:text-emerald-700'}`}
                    onClick={() => selectTab(tab.key)}
                  >
                    {Icon ? <Icon className="text-base" /> : tab.label}
                    {selected && <span className="absolute inset-x-2 bottom-0 h-0.5 bg-slate-900" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div role="tabpanel">
            {activeTab === 'apply_cv' && <CampaignApplyCvPanel publicId={publicId} />}
            {activeTab === 'job' && <CampaignJobsPanel publicId={publicId} report={report} />}
            {activeTab === 'upload_cv' && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600"><FileAddOutlined /></span>
                <p className="mt-4 font-semibold text-slate-700">Tải CV ứng viên lên chiến dịch</p>
                <Link to={`/tuyendung/app/applications?campaign=${publicId}`} className="mt-3 inline-flex h-9 items-center rounded bg-emerald-600 px-4 font-semibold !text-white hover:bg-emerald-700">
                  <UploadOutlined className="mr-2" /> Mở trang quản lý CV
                </Link>
              </div>
            )}
            {!['apply_cv', 'job', 'upload_cv'].includes(activeTab) && <EmptyTab label={activeTabLabel} />}
          </div>
        </section>
      </div>
    </section>
  )
}

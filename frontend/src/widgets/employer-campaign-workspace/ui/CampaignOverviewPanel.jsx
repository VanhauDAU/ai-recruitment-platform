import {
  ArrowRightOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  CheckCircleOutlined,
  EyeInvisibleOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Select, Skeleton } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import {
  campaignKeys,
  getCampaignJobPerformance,
} from '@/entities/campaign'
import {
  CampaignMetric,
  CampaignSectionTitle,
} from './CampaignOverviewCards'
import CampaignPerformanceChart from './CampaignPerformanceChart'
import {
  CAMPAIGN_FUNNEL_STAGES,
  CAMPAIGN_PERFORMANCE_METRICS,
} from './campaign-overview-options'

function numericValue(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function formatNumber(value, fallback = '—') {
  const parsed = numericValue(value)
  return parsed == null ? fallback : parsed.toLocaleString('vi-VN')
}

function formatPerformanceValue(metric, summary) {
  const value = numericValue(summary?.[metric.key])
  if (value == null) return '—'
  return metric.rate ? `${value.toLocaleString('vi-VN')}%` : formatNumber(value)
}

export default function CampaignOverviewPanel({ campaign, report, reportLoading = false }) {
  const [days, setDays] = useState(7)
  const performanceQuery = useQuery({
    queryKey: campaignKeys.jobPerformance(campaign.public_id, days),
    queryFn: () => getCampaignJobPerformance(campaign.public_id, days),
  })
  const performance = performanceQuery.data || {}
  const funnel = report.funnel || {}
  const funnelItems = CAMPAIGN_FUNNEL_STAGES.map((stage) => ({
    ...stage,
    value: numericValue(funnel[stage.key]) || 0,
  }))
  const funnelTotal = funnelItems.reduce((total, item) => total + item.value, 0)
  const totalJobs = report.jobs?.total ?? campaign.job_count
  const actionItems = [
    {
      count: numericValue(report.unviewed_count ?? campaign.unviewed_count) || 0,
      label: 'CV mới chưa xem',
      helper: 'Mở danh sách và sàng lọc',
      icon: TeamOutlined,
      to: '?active_tab=apply_cv',
      tone: 'bg-amber-50 text-amber-600',
    },
    {
      count: numericValue(campaign.pending_job_count) || 0,
      label: 'Tin đang chờ duyệt',
      helper: 'Theo dõi tiến trình kiểm duyệt',
      icon: FileTextOutlined,
      to: '?active_tab=job',
      tone: 'bg-sky-50 text-sky-600',
    },
    {
      count: numericValue(campaign.expired_job_count) || 0,
      label: 'Tin đã hết hạn',
      helper: 'Kiểm tra và gia hạn nếu cần',
      icon: CalendarOutlined,
      to: '?active_tab=job',
      tone: 'bg-rose-50 text-rose-600',
    },
  ]
  const pendingActions = actionItems.filter((item) => item.count > 0)
  const pendingTotal = pendingActions.reduce((total, item) => total + item.count, 0)
  const jobHealth = [
    { label: 'Đang tuyển', value: report.jobs?.active ?? campaign.active_job_count, dot: 'bg-emerald-500' },
    { label: 'Chờ duyệt', value: report.jobs?.pending ?? campaign.pending_job_count, dot: 'bg-sky-500' },
    { label: 'Bản nháp', value: report.jobs?.draft ?? campaign.draft_job_count, dot: 'bg-slate-400' },
    { label: 'Hết hạn', value: report.jobs?.expired ?? campaign.expired_job_count, dot: 'bg-amber-500' },
    { label: 'Đã đóng', value: report.jobs?.closed ?? campaign.closed_job_count, dot: 'bg-violet-500' },
    { label: 'Từ chối', value: report.jobs?.rejected ?? campaign.rejected_job_count, dot: 'bg-rose-500' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <CampaignMetric
          icon={TeamOutlined}
          label="Ứng viên duy nhất"
          value={formatNumber(report.candidate_count ?? campaign.candidate_count)}
          hint="Trong toàn chiến dịch"
          tone="slate"
        />
        <CampaignMetric
          icon={FileDoneOutlined}
          label="Hồ sơ ứng tuyển"
          value={formatNumber(report.application_pair_count
            ?? campaign.application_pair_count
            ?? report.application_submission_count
            ?? campaign.application_submission_count
            ?? campaign.application_count)}
          hint="Hồ sơ mới nhất theo từng tin"
          tone="blue"
        />
        <CampaignMetric
          icon={EyeInvisibleOutlined}
          label="Hồ sơ mới / chưa xem"
          value={formatNumber(report.unviewed_count ?? campaign.unviewed_count)}
          hint="Cần ưu tiên xử lý"
          tone="amber"
        />
        <CampaignMetric
          icon={RiseOutlined}
          label="Tin đang tuyển"
          value={formatNumber(report.jobs?.active ?? campaign.active_job_count)}
          hint={`${formatNumber(totalJobs, '0')} tin trong chiến dịch`}
          tone="green"
        />
        <CampaignMetric
          icon={CheckCircleOutlined}
          label="Ứng viên đã tuyển"
          value={formatNumber(report.accepted_count ?? campaign.accepted_count)}
          hint="Ứng viên duy nhất đã nhận"
          tone="violet"
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:col-span-2">
          <CampaignSectionTitle
            title="Hiệu quả tin tuyển dụng"
            description="Xu hướng hiển thị, lượt xem và ứng tuyển trong khoảng thời gian đã chọn."
            action={(
              <Select
                aria-label="Khoảng thời gian hiệu quả"
                value={days}
                onChange={setDays}
                options={[
                  { value: 7, label: '7 ngày qua' },
                  { value: 30, label: '30 ngày qua' },
                  { value: 90, label: '90 ngày qua' },
                ]}
                className="w-36"
              />
            )}
          />

          {performanceQuery.isError ? (
            <Alert
              className="mt-5"
              type="error"
              showIcon
              message="Không thể tải dữ liệu hiệu quả"
              action={(
                <Button size="small" danger onClick={() => performanceQuery.refetch()}>
                  Thử lại
                </Button>
              )}
            />
          ) : performanceQuery.isLoading ? (
            <Skeleton active className="mt-5" paragraph={{ rows: 6 }} />
          ) : (
            <>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {CAMPAIGN_PERFORMANCE_METRICS.map((metric) => (
                  <div key={metric.key} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                    <p className="text-xs font-medium text-slate-500">{metric.label}</p>
                    <strong className="mt-1 block text-lg font-bold text-slate-900">
                      {formatPerformanceValue(metric, performance.summary)}
                    </strong>
                  </div>
                ))}
              </div>
              <div className="mt-4 min-w-0 rounded-xl bg-gradient-to-b from-slate-50 to-white px-2 pb-2 pt-3 sm:px-3">
                <CampaignPerformanceChart data={performance.daily || []} />
              </div>
              <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-400">
                <SafetyCertificateOutlined className="mt-1 shrink-0 text-emerald-500" aria-hidden />
                Dữ liệu tương tác được tổng hợp ẩn danh và chỉ ghi nhận khi người xem đồng ý Analytics.
              </p>
            </>
          )}
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <CampaignSectionTitle
            title="Việc cần xử lý"
            description="Những mục nên được ưu tiên hôm nay."
            action={pendingTotal > 0 ? (
              <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-rose-50 px-2 py-1 text-xs font-bold text-rose-600">
                {formatNumber(pendingTotal)}
              </span>
            ) : null}
          />
          {pendingActions.length > 0 ? (
            <div className="mt-4 space-y-2.5">
              {pendingActions.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 p-3 !text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50"
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
                      <Icon aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-700">{item.label}</span>
                      <span className="mt-0.5 block text-xs text-slate-400">{item.helper}</span>
                    </span>
                    <strong className="text-base text-slate-900">{formatNumber(item.count)}</strong>
                    <ArrowRightOutlined className="text-xs text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" aria-hidden />
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-center">
              <CheckCircleFilled className="text-2xl text-emerald-500" aria-hidden />
              <p className="mt-2 text-sm font-semibold text-emerald-800">Mọi việc đang ổn</p>
              <p className="mt-1 text-xs leading-5 text-emerald-700">Không có CV mới, tin chờ duyệt hoặc tin hết hạn cần xử lý.</p>
            </div>
          )}
        </aside>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:col-span-2">
          <CampaignSectionTitle
            title="Phân bổ trạng thái hồ sơ"
            description="Trạng thái mới nhất của từng cặp ứng viên và tin tuyển dụng — không phải tỷ lệ chuyển đổi."
          />
          {reportLoading && !report.funnel ? (
            <Skeleton active className="mt-5" paragraph={{ rows: 3 }} />
          ) : funnelTotal > 0 ? (
            <>
              <div
                role="img"
                aria-label={`Phân bổ ${formatNumber(funnelTotal)} hồ sơ theo trạng thái`}
                className="mt-5 flex h-3 overflow-hidden rounded-full bg-slate-100"
              >
                {funnelItems.filter((item) => item.value > 0).map((item) => (
                  <span
                    key={item.key}
                    title={`${item.label}: ${formatNumber(item.value)}`}
                    className="h-full min-w-1 border-r border-white last:border-r-0"
                    style={{ width: `${(item.value / funnelTotal) * 100}%`, backgroundColor: item.color }}
                  />
                ))}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
                {funnelItems.map((item) => (
                  <div key={item.key} className="flex min-w-0 items-center gap-2.5">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.dotClass}`} />
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{item.label}</span>
                    <strong className="text-sm text-slate-800">{formatNumber(item.value)}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
              <TeamOutlined className="text-2xl text-slate-300" aria-hidden />
              <p className="mt-2 text-sm font-medium text-slate-500">Chưa có hồ sơ để phân bổ trạng thái</p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <CampaignSectionTitle
            title="Tình trạng tin tuyển dụng"
            description={`${formatNumber(totalJobs, '0')} tin trong chiến dịch`}
          />
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            {jobHealth.map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  <span className={`h-2 w-2 rounded-full ${item.dot}`} />
                  {item.label}
                </span>
                <strong className="mt-1.5 block text-lg text-slate-900">{formatNumber(item.value, '0')}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

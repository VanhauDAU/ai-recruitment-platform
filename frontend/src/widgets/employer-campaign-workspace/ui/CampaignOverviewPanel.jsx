import {
  CalendarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Select, Skeleton } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  campaignKeys,
  getCampaignJobPerformance,
} from '@/entities/campaign'
import CampaignPerformanceChart from './CampaignPerformanceChart'

const FUNNEL_LABELS = {
  submitted: 'Mới',
  viewed: 'Đã xem',
  considering: 'Cân nhắc',
  shortlisted: 'Phù hợp',
  interviewed: 'Phỏng vấn',
  accepted: 'Đã tuyển',
  rejected: 'Từ chối',
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatNumber(value) {
  return number(value).toLocaleString('vi-VN')
}

function Metric({ label, value, hint, tone = 'slate' }) {
  const colors = {
    slate: 'border-t-slate-700 text-slate-800',
    blue: 'border-t-sky-500 text-sky-600',
    green: 'border-t-emerald-500 text-emerald-600',
    amber: 'border-t-amber-400 text-amber-600',
  }
  return (
    <article className={`border border-slate-200 border-t-2 bg-white px-4 py-4 ${colors[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <strong className="mt-2 block text-2xl">{value}</strong>
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </article>
  )
}

export default function CampaignOverviewPanel({ campaign, report }) {
  const [days, setDays] = useState(7)
  const performanceQuery = useQuery({
    queryKey: campaignKeys.jobPerformance(campaign.public_id, days),
    queryFn: () => getCampaignJobPerformance(campaign.public_id, days),
  })
  const performance = performanceQuery.data || {}
  const funnel = report.funnel || {}
  const totalFunnel = Math.max(...Object.values(funnel).map(number), 1)

  return (
    <div className="space-y-4 p-4 lg:p-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Ứng viên duy nhất"
          value={formatNumber(report.candidate_count ?? campaign.candidate_count)}
          tone="slate"
        />
        <Metric
          label="Hồ sơ ứng tuyển"
          value={formatNumber(
            report.application_pair_count
              ?? campaign.application_pair_count
              ?? report.application_submission_count
              ?? campaign.application_submission_count
              ?? campaign.application_count,
          )}
          tone="blue"
        />
        <Metric
          label="Hồ sơ mới / chưa xem"
          value={formatNumber(report.unviewed_count ?? campaign.unviewed_count)}
          tone="amber"
        />
        <Metric
          label="Tin đang tuyển"
          value={formatNumber(report.jobs?.active ?? campaign.active_job_count)}
          hint={`${formatNumber(report.jobs?.total ?? campaign.job_count)} tin trong chiến dịch`}
          tone="green"
        />
      </div>

      <div>
        <section className="border border-slate-200 bg-white p-4">
          <h2 className="font-bold text-slate-800">Việc cần xử lý</h2>
          <div className="mt-3 space-y-2">
            {[
              {
                count: report.unviewed_count || 0,
                label: 'CV mới chưa xem',
                icon: TeamOutlined,
                to: `?active_tab=apply_cv`,
              },
              {
                count: campaign.pending_job_count || 0,
                label: 'Tin đang chờ duyệt',
                icon: FileTextOutlined,
                to: '?active_tab=job',
              },
              {
                count: campaign.expired_job_count || 0,
                label: 'Tin đã hết hạn',
                icon: CalendarOutlined,
                to: '?active_tab=job',
              },
            ].map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 !text-slate-700 hover:bg-slate-50"
                >
                  <Icon className="text-emerald-600" />
                  <span className="min-w-0 flex-1 text-sm">{item.label}</span>
                  <strong>{item.count}</strong>
                </Link>
              )
            })}
            {!report.unviewed_count
              && !campaign.pending_job_count
              && !campaign.expired_job_count && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                  <CheckCircleOutlined /> Không có công việc tồn đọng.
                </div>
            )}
          </div>
        </section>
      </div>

      <section className="border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-800">Hiệu quả tin tuyển dụng</h2>
            <p className="text-xs text-slate-400">Dữ liệu tổng hợp, không lưu danh tính người xem.</p>
          </div>
          <Select
            value={days}
            onChange={setDays}
            options={[
              { value: 7, label: '7 ngày qua' },
              { value: 30, label: '30 ngày qua' },
              { value: 90, label: '90 ngày qua' },
            ]}
            className="w-36"
          />
        </div>
        {performanceQuery.isError ? (
          <Alert
            className="mt-4"
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
          <Skeleton active className="mt-4" paragraph={{ rows: 5 }} />
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                ['Hiển thị', performance.summary?.impressions],
                ['Xem tin', performance.summary?.views],
                ['Ứng tuyển', performance.summary?.applications],
                ['Tỷ lệ xem', performance.summary?.view_rate == null ? '—' : `${performance.summary.view_rate}%`],
                ['Tỷ lệ ứng tuyển', performance.summary?.application_rate == null ? '—' : `${performance.summary.application_rate}%`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{label}</p>
                  <strong className="mt-1 block text-lg text-slate-800">
                    {typeof value === 'number' ? formatNumber(value) : value ?? '—'}
                  </strong>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <CampaignPerformanceChart data={performance.daily || []} />
            </div>
          </>
        )}
      </section>

      <section className="border border-slate-200 bg-white p-4">
        <h2 className="font-bold text-slate-800">Funnel ứng viên</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(FUNNEL_LABELS).map(([key, label]) => {
            const value = number(funnel[key])
            const percent = Math.round((value / totalFunnel) * 100)
            return (
              <div key={key} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-slate-600">{label}</span>
                  <strong className="text-slate-800">{value}</strong>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className="block h-full rounded-full bg-emerald-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        {report.applications?.latest_total === 0 && (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            <ExclamationCircleOutlined /> Funnel sẽ hiển thị khi chiến dịch nhận CV.
          </p>
        )}
      </section>
    </div>
  )
}

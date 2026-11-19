import { Tooltip } from 'antd'
import { m } from '@/shared/config/i18n'

const JOB_STATUS_SUMMARIES = [
  { key: 'active_job_count', label: m.employer_campaign_jobs_status_active(), className: 'bg-emerald-50 text-emerald-700' },
  { key: 'draft_job_count', label: m.employer_campaign_jobs_status_draft(), className: 'bg-slate-100 text-slate-600' },
  { key: 'expired_job_count', label: m.employer_campaign_jobs_expired(), className: 'bg-orange-50 text-orange-700' },
]

function count(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

// Số tin và tổng người cần tuyển; thêm tin làm ở trang chi tiết hoặc wizard.
export default function CampaignJobsSummary({ campaign }) {
  const total = count(campaign.job_count)
  const statuses = JOB_STATUS_SUMMARIES.filter((item) => count(campaign[item.key]) > 0)

  return (
    <div className="min-w-0" data-testid={`campaign-jobs-${campaign.public_id}`}>
      <strong className="block text-sm text-slate-800">{total ? m.employer_campaign_jobs_summary_total({ count: total }) : m.employer_campaign_hero_no_jobs()}</strong>
      {total > 0 && (
        <Tooltip title={m.employer_campaign_jobs_summary_headcount_tooltip()}>
          <span className="text-xs text-slate-500">{m.employer_campaign_jobs_summary_headcount({ count: count(campaign.headcount) })}</span>
        </Tooltip>
      )}
      {statuses.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {statuses.map((item) => (
            <span key={item.key} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.className}`}>
              {item.label} {count(campaign[item.key])}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

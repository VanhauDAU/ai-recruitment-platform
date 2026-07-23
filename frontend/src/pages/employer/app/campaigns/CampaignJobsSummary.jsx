import { PlusOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { Link } from 'react-router-dom'

const JOB_STATUS_SUMMARIES = [
  { key: 'active_job_count', label: 'Đang tuyển', className: 'bg-emerald-50 text-emerald-700' },
  { key: 'pending_job_count', label: 'Chờ duyệt', className: 'bg-amber-50 text-amber-700' },
  { key: 'draft_job_count', label: 'Nháp', className: 'bg-slate-100 text-slate-600' },
  { key: 'expired_job_count', label: 'Hết hạn', className: 'bg-orange-50 text-orange-700' },
  { key: 'rejected_job_count', label: 'Từ chối', className: 'bg-red-50 text-red-700' },
]

function count(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

export default function CampaignJobsSummary({ campaign, compact = false, onCreate }) {
  const total = count(campaign.job_count)
  const statuses = JOB_STATUS_SUMMARIES.filter((item) => count(campaign[item.key]) > 0)
  const canCreate = !['cancelled', 'completed'].includes(campaign.status)

  return (
    <div className={`min-w-0 ${compact ? '' : 'min-w-64'}`} data-testid={`campaign-jobs-${campaign.public_id}`}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">Tổng tin tuyển dụng</p>
          <strong className="mt-0.5 block text-lg leading-none text-slate-800">{total}</strong>
        </div>
        <Link
          className="text-xs font-semibold !text-emerald-700 hover:!text-emerald-800 hover:underline"
          to={`/tuyendung/app/campaigns/${campaign.public_id}?tab=jobs`}
        >
          Quản lý tin
        </Link>
      </div>
      {total === 0 ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-xs text-slate-500">Chưa có tin tuyển dụng</span>
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            disabled={!canCreate}
            title={canCreate ? undefined : 'Chiến dịch đã kết thúc nên không thể thêm tin.'}
            onClick={onCreate}
          >
            Đăng tin
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {statuses.map((item) => (
              <span key={item.key} className={`rounded-full px-2 py-1 text-[11px] font-semibold ${item.className}`}>
                {item.label} {count(campaign[item.key])}
              </span>
            ))}
          </div>
          <Button
            className="!mt-2 !h-auto !px-0"
            type="link"
            icon={<PlusOutlined />}
            disabled={!canCreate}
            title={canCreate ? undefined : 'Chiến dịch đã kết thúc nên không thể thêm tin.'}
            onClick={onCreate}
          >
            Đăng thêm tin
          </Button>
        </>
      )}
    </div>
  )
}

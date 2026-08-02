import {
  CalendarOutlined,
  ClockCircleOutlined,
  EditOutlined,
  HistoryOutlined,
  PlusOutlined,
  RocketOutlined,
} from '@ant-design/icons'
import { Button } from 'antd'
import { Link } from 'react-router'
import { CAMPAIGN_STATUS_LABELS } from '@/entities/campaign'
import { CampaignLifecycleActions } from '@/features/manage-campaigns'
import { employerAppPath } from '@/shared/config/portals'

const STATUS_TONES = {
  active: ['border-emerald-200 bg-emerald-50 text-emerald-700', 'bg-emerald-500'],
  paused: ['border-amber-200 bg-amber-50 text-amber-700', 'bg-amber-500'],
  draft: ['border-sky-200 bg-sky-50 text-sky-700', 'bg-sky-500'],
  completed: ['border-slate-200 bg-slate-100 text-slate-600', 'bg-slate-400'],
  cancelled: ['border-rose-200 bg-rose-50 text-rose-700', 'bg-rose-500'],
}

function formatDate(value, includeTime = false) {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có'
  return includeTime
    ? date.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : date.toLocaleDateString('vi-VN')
}

export default function CampaignWorkspaceHero({ campaign, onEdit }) {
  const statusLabel = CAMPAIGN_STATUS_LABELS[campaign.status]
    || campaign.status_label
    || campaign.status
  const [statusClass, statusDotClass] = STATUS_TONES[campaign.status] || STATUS_TONES.completed

  return (
    <header
      data-testid="campaign-hero"
      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50" />
      <div className="relative p-4 sm:p-5 lg:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3.5 sm:gap-4">
            <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-xl text-white shadow-lg shadow-emerald-600/20 sm:flex">
              <RocketOutlined aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                  <span aria-hidden className={`h-2 w-2 rounded-full ${statusDotClass}`} />
                  {statusLabel}
                </span>
                <span className="max-w-full truncate rounded-md border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs text-slate-500 shadow-sm">
                  {campaign.public_id}
                </span>
              </div>
              <h1 className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                {campaign.name}
              </h1>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarOutlined className="text-emerald-600" aria-hidden />
                  Tạo ngày {formatDate(campaign.created_at)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ClockCircleOutlined className="text-slate-400" aria-hidden />
                  Cập nhật {formatDate(campaign.updated_at, true)}
                </span>
              </div>
            </div>
          </div>

          <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap lg:justify-end">
            {campaign.status === 'active' && (
              <Link to={`${employerAppPath('/jobs/new')}?campaign=${campaign.public_id}`} className="block sm:inline-flex">
                <Button
                  type="primary"
                  icon={<PlusOutlined aria-hidden />}
                  className="!h-10 !w-full !rounded-xl !border-0 !bg-emerald-600 !px-4 !font-semibold !shadow-md transition hover:!bg-emerald-500 sm:!w-auto"
                >
                  Đăng thêm tin
                </Button>
              </Link>
            )}
            <Button
              icon={<EditOutlined aria-hidden />}
              className="!h-10 !w-full !rounded-xl !border-slate-200 !bg-white !px-4 !font-semibold !text-slate-700 !shadow-sm transition hover:!border-emerald-300 hover:!text-emerald-700 sm:!w-auto"
              onClick={onEdit}
            >
              Sửa chiến dịch
            </Button>
            <CampaignLifecycleActions campaign={campaign} block />
          </div>
        </div>

        <div className="mt-5 flex min-w-0 items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 sm:items-center">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm">
            <HistoryOutlined aria-hidden />
          </span>
          <div className="min-w-0 text-sm">
            <span className="font-semibold text-slate-700">Hoạt động gần nhất</span>
            <span className="mx-2 text-slate-300">•</span>
            <span className="text-slate-600">{campaign.last_activity?.label || 'Chưa có hoạt động'}</span>
            <span className="mt-0.5 block text-xs text-slate-400 sm:ml-2 sm:inline">
              {formatDate(campaign.last_activity?.occurred_at, true)}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

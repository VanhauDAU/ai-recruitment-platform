import {
  EyeOutlined,
  FileSearchOutlined,
  InboxOutlined,
  TeamOutlined,
} from '@ant-design/icons'

const CARD_DEFINITIONS = [
  {
    key: 'jobs_active',
    label: 'Tin đang tuyển',
    icon: FileSearchOutlined,
    iconClass: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    accent: 'from-emerald-500 to-teal-500',
    caption: (summary) => `${summary.jobs_pending || 0} chờ duyệt · ${summary.jobs_draft || 0} bản nháp`,
  },
  {
    key: 'applications_total',
    label: 'Tổng hồ sơ',
    icon: TeamOutlined,
    iconClass: 'bg-blue-50 text-blue-600 ring-blue-100',
    accent: 'from-blue-500 to-indigo-500',
    caption: (summary) => `${summary.applications_new || 0} hồ sơ mới cần xem`,
  },
  {
    key: 'applications_new',
    label: 'Hồ sơ mới',
    icon: InboxOutlined,
    iconClass: 'bg-amber-50 text-amber-600 ring-amber-100',
    accent: 'from-amber-400 to-orange-500',
    caption: (summary) => `${summary.applications_shortlisted || 0} phù hợp · ${summary.applications_interviewed || 0} phỏng vấn`,
  },
  {
    key: 'job_views',
    label: 'Lượt xem tin',
    icon: EyeOutlined,
    iconClass: 'bg-violet-50 text-violet-600 ring-violet-100',
    accent: 'from-violet-500 to-fuchsia-500',
    caption: (summary) => {
      const rate = summary.job_views ? Math.round(((summary.applications_total || 0) / summary.job_views) * 1000) / 10 : 0
      return `${rate}% chuyển đổi thành hồ sơ`
    },
  },
]

const numberFormatter = new Intl.NumberFormat('vi-VN')

export default function DashboardSummaryCards({ summary = {} }) {
  return (
    <section aria-label="Số liệu tuyển dụng" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {CARD_DEFINITIONS.map((card) => {
        const Icon = card.icon
        return (
          <article key={card.key} className="group relative overflow-hidden rounded-[18px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,.55)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-22px_rgba(15,23,42,.38)]">
            <span className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${card.accent} opacity-70`} />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-500">{card.label}</p>
                <strong className="mt-2 block text-[30px] font-black leading-none tracking-[-.03em] text-slate-900">{numberFormatter.format(summary[card.key] || 0)}</strong>
              </div>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ring-1 transition duration-300 group-hover:scale-105 ${card.iconClass}`}><Icon /></span>
            </div>
            <p className="mt-4 truncate text-[11px] font-medium text-slate-400">{card.caption(summary)}</p>
          </article>
        )
      })}
    </section>
  )
}

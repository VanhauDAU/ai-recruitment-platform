import { BarChartOutlined, EyeOutlined, FileSearchOutlined, TeamOutlined } from '@ant-design/icons'

const CARD_DEFINITIONS = [
  { key: 'jobs_active', label: 'Tin đang tuyển', icon: FileSearchOutlined, tone: 'emerald' },
  { key: 'applications_total', label: 'Tổng hồ sơ', icon: TeamOutlined, tone: 'blue' },
  { key: 'applications_new', label: 'Hồ sơ mới', icon: BarChartOutlined, tone: 'amber' },
  { key: 'job_views', label: 'Lượt xem tin', icon: EyeOutlined, tone: 'violet' },
]

const TONES = {
  emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  blue: 'bg-blue-50 text-blue-600 ring-blue-100',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  violet: 'bg-violet-50 text-violet-600 ring-violet-100',
}

const numberFormatter = new Intl.NumberFormat('vi-VN')

export default function DashboardSummaryCards({ summary = {} }) {
  return (
    <section aria-label="Số liệu tuyển dụng" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {CARD_DEFINITIONS.map((card) => {
        const Icon = card.icon
        return (
          <article key={card.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-500">{card.label}</p>
                <strong className="mt-3 block text-3xl font-black tracking-tight text-slate-900">{numberFormatter.format(summary[card.key] || 0)}</strong>
              </div>
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${TONES[card.tone]}`}><Icon className="text-xl" /></span>
            </div>
          </article>
        )
      })}
    </section>
  )
}

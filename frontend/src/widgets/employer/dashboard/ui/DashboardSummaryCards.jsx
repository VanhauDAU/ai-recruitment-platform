import {
  EyeOutlined,
  FileSearchOutlined,
  InboxOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { getIntlLocale, m } from '@/shared/config/i18n'

const CARD_DEFINITIONS = [
  {
    key: 'jobs_active',
    label: m.employer_workspace_dash_active_jobs(),
    icon: FileSearchOutlined,
    iconClass: 'employer-dash-icon employer-dash-icon-ring',
    accent: 'employer-dash-accent',
    caption: (summary) => (summary.jobs_hidden
      ? m.employer_workspace_dash_hidden_jobs({ count: summary.jobs_hidden })
      : m.employer_workspace_dash_unpublished_drafts({ count: summary.jobs_draft || 0 })),
  },
  {
    key: 'applications_total',
    label: m.employer_workspace_dash_total_applications(),
    icon: TeamOutlined,
    iconClass: 'bg-blue-50 text-blue-600 ring-blue-100',
    accent: 'bg-gradient-to-r from-blue-500 to-indigo-500',
    caption: (summary) => m.employer_workspace_dash_new_applications_to_review({ count: summary.applications_new || 0 }),
  },
  {
    key: 'applications_new',
    label: m.employer_workspace_dash_new_applications_label(),
    icon: InboxOutlined,
    iconClass: 'bg-amber-50 text-amber-600 ring-amber-100',
    accent: 'bg-gradient-to-r from-amber-400 to-orange-500',
    caption: (summary) => m.employer_workspace_dash_shortlisted_interviewed({ shortlisted: summary.applications_shortlisted || 0, interviewed: summary.applications_interviewed || 0 }),
  },
  {
    key: 'job_views',
    label: m.employer_workspace_dash_job_views(),
    icon: EyeOutlined,
    iconClass: 'bg-violet-50 text-violet-600 ring-violet-100',
    accent: 'bg-gradient-to-r from-violet-500 to-fuchsia-500',
    caption: (summary) => {
      const rate = summary.job_views ? Math.round(((summary.applications_total || 0) / summary.job_views) * 1000) / 10 : 0
      return m.employer_workspace_dash_conversion_rate({ rate })
    },
  },
]

const numberFormatter = new Intl.NumberFormat(getIntlLocale())

export default function DashboardSummaryCards({ summary = {} }) {
  return (
    <section aria-label={m.employer_workspace_dash_metrics()} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {CARD_DEFINITIONS.map((card) => {
        const Icon = card.icon
        return (
          <article key={card.key} className="group relative overflow-hidden rounded-[18px] border border-slate-200/80 bg-white p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,.55)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_-22px_rgba(15,23,42,.38)]">
            <span className={`absolute inset-x-0 top-0 h-0.5 ${card.accent} opacity-70`} />
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

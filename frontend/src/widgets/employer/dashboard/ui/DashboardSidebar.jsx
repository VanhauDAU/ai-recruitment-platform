import {
  ArrowRightOutlined,
  BankOutlined,
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  EnvironmentOutlined,
  FileDoneOutlined,
  FormOutlined,
  InboxOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router'
import {
  EMPLOYER_RECRUITMENT_DEMAND_URL,
  EMPLOYER_VERIFY_URL,
  employerAppPath,
} from '@/shared/config/portals'
import CodeBadge from '@/shared/ui/code-badge/CodeBadge'
import { getIntlLocale, m } from '@/shared/config/i18n'

const dateFormatter = new Intl.DateTimeFormat(getIntlLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' })
const numberFormatter = new Intl.NumberFormat(getIntlLocale())

function PriorityAction({ icon, label, detail, tone, to }) {
  const Icon = icon
  return (
    <Link to={to} className="group flex items-center gap-3 rounded-xl border border-slate-100 !bg-slate-50/70 px-3 py-2.5 transition employer-dash-hover-tint">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon /></span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-xs text-slate-800">{label}</strong>
        <span className="mt-0.5 block truncate text-[11px] text-slate-400">{detail}</span>
      </span>
      <ArrowRightOutlined className="text-xs text-slate-300 transition group-hover:translate-x-0.5 employer-dash-hover-text" />
    </Link>
  )
}

export default function DashboardSidebar({
  account = {},
  recruitmentNeed,
  summary = {},
  candidateActionTarget,
  jobWorkspaceReady,
}) {
  const employerVerified = Boolean(account.verification?.representative_verified)

  return (
    <aside className="space-y-4">
      <section className="rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-[0_12px_35px_-26px_rgba(15,23,42,.45)]" aria-labelledby="priority-actions-title">
        <div className="flex items-center justify-between px-2 pb-2">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.14em] employer-dash-text">{m.employer_workspace_dash_priority_eyebrow()}</p>
            <h2 id="priority-actions-title" className="mt-1 text-base font-black text-slate-900">{m.employer_workspace_dash_priority_title()}</h2>
          </div>
          <ClockCircleOutlined className="text-lg text-slate-300" />
        </div>
        <div className="mt-2 space-y-2">
          <PriorityAction
            icon={InboxOutlined}
            label={m.employer_workspace_dash_new_applications({ count: numberFormatter.format(summary.applications_new || 0) })}
            detail={m.employer_workspace_dash_new_applications_detail()}
            tone="bg-blue-50 text-blue-600"
            to={candidateActionTarget}
          />
          <PriorityAction
            icon={FileDoneOutlined}
            label={m.employer_workspace_dash_unpublished_drafts({ count: numberFormatter.format(summary.jobs_draft || 0) })}
            detail={m.employer_workspace_dash_drafts_detail()}
            tone="bg-amber-50 text-amber-600"
            to={jobWorkspaceReady ? employerAppPath('/tin-tuyen-dung') : EMPLOYER_VERIFY_URL}
          />
          <PriorityAction
            icon={employerVerified ? CheckCircleFilled : FormOutlined}
            label={employerVerified ? m.employer_workspace_dash_employer_verified() : m.employer_workspace_dash_complete_verification()}
            detail={employerVerified ? m.employer_workspace_dash_employer_verified_detail() : m.employer_workspace_dash_complete_verification_detail()}
            tone={employerVerified ? 'bg-emerald-50 text-emerald-600' : 'bg-violet-50 text-violet-600'}
            to={EMPLOYER_VERIFY_URL}
          />
        </div>
      </section>

      <section className="rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_35px_-26px_rgba(15,23,42,.45)]" aria-labelledby="recruitment-need-title">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-400">{m.employer_workspace_dash_plan_eyebrow()}</p>
            <h2 id="recruitment-need-title" className="mt-1 font-black text-slate-900">{m.employer_workspace_dash_plan_title()}</h2>
          </div>
          <Link to={EMPLOYER_RECRUITMENT_DEMAND_URL} aria-label={m.employer_workspace_dash_update_need()} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 !bg-slate-100 !text-slate-500 transition employer-dash-hover-tint"><SettingOutlined /></Link>
        </div>
        {recruitmentNeed ? (
          <div className="mt-4">
            <strong className="block text-sm leading-6 text-slate-900">{recruitmentNeed.position_category_name}</strong>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <NeedStat icon={TeamOutlined} label={m.employer_workspace_dash_need_headcount()} value={m.employer_workspace_dash_need_headcount_value({ count: recruitmentNeed.headcount })} />
              <NeedStat icon={CalendarOutlined} label={m.employer_workspace_dash_need_deadline()} value={recruitmentNeed.is_continuous ? m.employer_workspace_dash_need_continuous() : recruitmentNeed.target_date ? dateFormatter.format(new Date(`${recruitmentNeed.target_date}T00:00:00`)) : m.employer_workspace_dash_need_not_set()} />
            </div>
            <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-500">{m.employer_workspace_dash_need_level()} <strong className="float-right text-slate-700">{recruitmentNeed.position_level_label}</strong></div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-4 text-center">
            <p className="text-xs leading-5 text-slate-500">{m.employer_workspace_dash_need_empty()}</p>
            <Link to={EMPLOYER_RECRUITMENT_DEMAND_URL} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border employer-dash-button px-3 text-xs font-bold shadow-sm transition">{m.employer_workspace_dash_need_add()} <ArrowRightOutlined /></Link>
          </div>
        )}
      </section>

      <section className="rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_35px_-26px_rgba(15,23,42,.45)]" aria-labelledby="company-summary-title">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><BankOutlined /></span>
          <div className="min-w-0 flex-1">
            <h2 id="company-summary-title" className="truncate text-sm font-black text-slate-900">{account.company_name || m.employer_workspace_dash_company_fallback()}</h2>
            <span className="mt-1.5 inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
              {m.employer_workspace_dash_company_profile()}
            </span>
          </div>
        </div>
        <div className="mt-4 space-y-2.5 text-[11px] text-slate-500">
          {account.work_location_name && <p className="flex items-center gap-2"><EnvironmentOutlined className="text-slate-400" /> <span className="truncate">{account.work_location_name}</span></p>}
          {account.company_size && <p className="flex items-center gap-2"><TeamOutlined className="text-slate-400" /> {m.employer_workspace_dash_company_size({ size: account.company_size })}</p>}
          {account.public_id && <p className="flex items-center gap-2"><BankOutlined className="text-slate-400" /> <CodeBadge code={account.public_id} label={m.employer_workspace_employer_code_label()} /></p>}
        </div>
      </section>
    </aside>
  )
}

function NeedStat({ icon, label, value }) {
  const Icon = icon
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <span className="flex items-center gap-1.5 text-[10px] text-slate-400"><Icon /> {label}</span>
      <strong className="mt-1.5 block truncate text-xs text-slate-700">{value}</strong>
    </div>
  )
}

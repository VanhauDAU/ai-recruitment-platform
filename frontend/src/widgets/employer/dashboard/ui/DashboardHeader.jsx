import {
  ArrowRightOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router'
import { employerAppPath } from '@/shared/config/portals'
import { getIntlLocale, m } from '@/shared/config/i18n'

const fullDateFormatter = new Intl.DateTimeFormat(getIntlLocale(), {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})

export default function DashboardHeader({
  displayName,
  account = {},
  jobActionTarget,
  candidateActionTarget,
}) {
  const employerVerified = Boolean(account.verification?.representative_verified)

  return (
    <header className="relative overflow-hidden rounded-[24px] employer-dash-hero px-5 py-6 text-white shadow-[0_18px_50px_-24px_rgba(15,23,42,.65)] sm:px-7 sm:py-7">
      <div className="pointer-events-none absolute -right-16 -top-28 h-64 w-64 rounded-full border-[38px] border-white/[.06]" />
      <div className="pointer-events-none absolute -bottom-32 right-[22%] h-64 w-64 rounded-full employer-dash-hero-glow blur-3xl" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold employer-dash-hero-meta">
            <span className="inline-flex items-center gap-1.5"><ClockCircleOutlined /> {fullDateFormatter.format(new Date())}</span>
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-white/40" />
            <span className="inline-flex items-center gap-1.5">
              <CheckCircleFilled className={employerVerified ? 'text-emerald-300' : 'text-amber-300'} />
              {employerVerified ? m.employer_workspace_dash_employer_verified() : m.employer_workspace_dash_verification_in_progress()}
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-[-.025em] text-white sm:text-[32px] sm:leading-tight">
            {m.employer_workspace_dash_greeting({ name: displayName })}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200/85">
            {m.employer_workspace_dash_greeting_subtitle()}
          </p>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row">
          <Link
            to={candidateActionTarget}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/25 !bg-white/10 px-4 text-sm font-bold !text-white backdrop-blur transition hover:-translate-y-0.5 hover:!bg-white/20"
          >
            {m.employer_workspace_dash_manage_applications()} <ArrowRightOutlined />
          </Link>
          <Link
            to={jobActionTarget}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white !bg-white px-4 text-sm font-extrabold employer-dash-hero-cta shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5"
          >
            <PlusOutlined /> {m.employer_workspace_dash_new_job()}
          </Link>
        </div>
      </div>

      <div className="relative mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-4 text-xs text-slate-200/80">
        <Link to={employerAppPath('/tin-tuyen-dung')} className="group inline-flex items-center gap-2 !text-inherit hover:!text-white">
          {m.employer_workspace_title_jobs()} <ArrowRightOutlined className="text-[10px] transition group-hover:translate-x-0.5" />
        </Link>
        <Link to={employerAppPath('/chien-dich')} className="group inline-flex items-center gap-2 !text-inherit hover:!text-white">
          {m.employer_workspace_title_campaigns()} <ArrowRightOutlined className="text-[10px] transition group-hover:translate-x-0.5" />
        </Link>
        <Link to={employerAppPath('/lich-su-hoat-dong')} className="group inline-flex items-center gap-2 !text-inherit hover:!text-white">
          {m.employer_workspace_title_activities()} <ArrowRightOutlined className="text-[10px] transition group-hover:translate-x-0.5" />
        </Link>
      </div>
    </header>
  )
}

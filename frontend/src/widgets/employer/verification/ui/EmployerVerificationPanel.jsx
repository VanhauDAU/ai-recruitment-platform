import { BarChartOutlined, SafetyCertificateOutlined, TeamOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Skeleton } from 'antd'
import { Navigate, useNavigate } from 'react-router'
import { getEmployerRecruitmentNeed, useEmployerReadiness } from '@/entities/account/employer-profile'
import { useSession } from '@/entities/account/session'
import { EmployerVerificationChecklist } from '@/features/employer/account/verify-employer-account'
import { employerAppPath } from '@/shared/config/portals'
import { m } from '@/shared/config/i18n'

function VerificationStory({ need, companyName }) {
  return (
    <aside className="relative overflow-hidden bg-[linear-gradient(155deg,#087f5b_0%,#006b50_54%,#063f3a_100%)] p-6 text-white sm:p-8 lg:min-h-[720px] lg:p-10">
      <span className="absolute -right-20 -top-20 h-72 w-72 rounded-full border-[32px] border-white/10" />
      <span className="absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-[var(--brand-primary)]/10" />
      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[.16em] text-emerald-100">
          <SafetyCertificateOutlined /> {m.employer_company_verify_trusted_badge()}
        </span>
        <p className="mt-8 text-sm text-white/70">{m.employer_company_verify_hiring_priority()}</p>
        <h2 className="mt-2 max-w-md text-2xl font-black leading-tight sm:text-3xl">
          {need?.position_category_name || m.employer_company_verify_default_position()}
        </h2>
        <p className="mt-3 text-sm text-emerald-100/80">{companyName || m.employer_company_verify_default_company()}</p>

        <div className="mt-10 hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-1">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-3"><TeamOutlined className="text-2xl text-[color-mix(in_srgb,var(--brand-primary)_40%,#fff)]" /><strong className="text-lg">{m.employer_company_verify_headcount({ count: need?.headcount || 1 })}</strong></div>
            <p className="mt-2 text-sm leading-6 text-white/70">{m.employer_company_verify_headcount_hint()}</p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-3"><BarChartOutlined className="text-2xl text-[color-mix(in_srgb,var(--brand-primary)_40%,#fff)]" /><strong className="text-lg">{m.employer_company_verify_start_title()}</strong></div>
            <p className="mt-2 text-sm leading-6 text-white/70">{m.employer_company_verify_start_hint()}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default function EmployerVerificationPanel() {
  const navigate = useNavigate()
  const { user } = useSession()
  const {
    profile,
    profileQuery,
    isAccessError,
    isChecking,
    canAccessCandidateData,
  } = useEmployerReadiness()
  const needQuery = useQuery({ queryKey: ['employer', 'recruitment-need'], queryFn: getEmployerRecruitmentNeed })

  if (isChecking && !profile) {
    return <div className="rounded-2xl bg-white p-8"><Skeleton active paragraph={{ rows: 14 }} /></div>
  }
  if (isAccessError) {
    return (
      <Alert
        type="error"
        showIcon
        title={m.employer_company_verify_load_error()}
        action={<Button size="small" onClick={() => profileQuery.refetch()}>{m.employer_company_retry()}</Button>}
      />
    )
  }

  const resolvedProfile = profile || {}
  if (canAccessCandidateData) {
    return <Navigate to={employerAppPath('/dashboard')} replace />
  }

  return (
    <div className="grid min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,.10)] xl:grid-cols-[minmax(300px,.85fr)_minmax(0,1.15fr)]">
      <VerificationStory
        need={needQuery.data}
        companyName={resolvedProfile.onboarding?.company_linked ? resolvedProfile.company?.company_name : ''}
      />
      <section className="min-w-0 p-5 sm:p-8 xl:p-10">
        <h1 className="text-2xl font-black text-slate-900">{m.employer_company_verify_greeting()} <span className="text-[var(--brand-primary)]">{user?.full_name || user?.email}</span></h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{m.employer_company_verify_intro()}</p>
        <div className="mt-8">
          <EmployerVerificationChecklist
            profile={resolvedProfile}
            onContinue={() => navigate(employerAppPath('/dashboard'), { replace: true })}
          />
        </div>
      </section>
    </div>
  )
}

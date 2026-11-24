import { CheckCircleFilled, ClockCircleOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Skeleton } from 'antd'
import {
  employerProfileKeys,
  getEmployerProfile,
  resolveEmployerBadgeEligibility,
} from '@/entities/account/employer-profile'
import { getIntlLocale, m } from '@/shared/config/i18n'

function eligibleDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(getIntlLocale())
}

export default function EmployerTrustBadgeEligibility({ profile: suppliedProfile, className = '' }) {
  const profileQuery = useQuery({
    queryKey: employerProfileKeys.profile,
    queryFn: getEmployerProfile,
    enabled: !suppliedProfile,
  })
  const profile = suppliedProfile || profileQuery.data
  const eligibility = resolveEmployerBadgeEligibility(profile)

  if (!suppliedProfile && profileQuery.isLoading) {
    return <div className={className}><Skeleton active paragraph={{ rows: 5 }} /></div>
  }
  if (!suppliedProfile && profileQuery.isError) {
    return (
      <Alert
        className={className}
        type="error"
        showIcon
        title={m.employer_account_badge_load_failed()}
        action={<button type="button" onClick={() => profileQuery.refetch()} className="font-semibold text-red-700 underline">{m.employer_account_domain_retry()}</button>}
      />
    )
  }
  if (!eligibility) return null

  const reached = eligibility.criteria.filter((item) => item.passed).length
  const total = eligibility.criteria.length
  const accountAgeDate = eligibleDate(eligibility.eligible_at)

  return (
    <section className={`min-w-0 rounded-sm border border-slate-200 bg-white p-5 sm:p-6 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
          <SafetyCertificateOutlined className="text-lg" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-slate-900">{m.employer_account_badge_title()}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {eligibility.verified
              ? m.employer_account_badge_verified()
              : m.employer_account_badge_progress({ reached, total })}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${eligibility.verified ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
          {reached}/{total}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {eligibility.criteria.map((criterion) => (
          <div
            key={criterion.key}
            className={`flex min-w-0 items-start gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm ${criterion.passed ? 'bg-white text-slate-700' : 'bg-slate-50 text-slate-500'}`}
          >
            {criterion.passed
              ? <CheckCircleFilled className="mt-0.5 shrink-0 text-emerald-600" />
              : <ClockCircleOutlined className="mt-0.5 shrink-0 text-slate-400" />}
            <span className="min-w-0 break-words">{criterion.label}</span>
          </div>
        ))}
      </div>

      {!eligibility.verified && accountAgeDate && (
        <p className="mt-3 text-xs leading-5 text-slate-600">
          {m.employer_account_badge_age_before()}<strong>{accountAgeDate}</strong>
          {eligibility.minimum_account_months
            ? m.employer_account_badge_age_threshold({ count: eligibility.minimum_account_months })
            : '.'}
        </p>
      )}
    </section>
  )
}

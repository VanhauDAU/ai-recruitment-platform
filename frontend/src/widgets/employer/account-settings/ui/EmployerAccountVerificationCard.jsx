import { ArrowRightOutlined, CheckCircleFilled } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from 'antd'
import { Link } from 'react-router'
import { getEmployerProfile } from '@/entities/account/employer-profile'
import {
  EmployerVerificationLifecycleAlert,
  getEmployerAccountVerificationLevel,
  isEmployerVerificationInvalidated,
} from '@/features/employer/account/verify-employer-account'
import {
  EMPLOYER_BUSINESS_LICENSE_URL,
  EMPLOYER_COMPANY_SETTINGS_URL,
  EMPLOYER_PHONE_VERIFY_URL,
  EMPLOYER_VERIFY_URL,
} from '@/shared/config/portals'
import { m } from '@/shared/config/i18n'

const STEPS = [
  { key: 'phone_verified', label: m.employer_account_checklist_phone_title(), to: EMPLOYER_PHONE_VERIFY_URL },
  { key: 'company_linked', label: m.employer_account_checklist_company_title(), to: `${EMPLOYER_COMPANY_SETTINGS_URL}?update=true` },
  { key: 'business_doc_approved', label: m.employer_account_level_step_business(), to: EMPLOYER_BUSINESS_LICENSE_URL },
]

export default function EmployerAccountVerificationCard() {
  const profileQuery = useQuery({ queryKey: ['employer', 'profile'], queryFn: getEmployerProfile })

  if (profileQuery.isLoading) {
    return (
      <div className="mb-5 rounded-sm border border-slate-200 bg-white p-5 sm:p-6">
        <Skeleton active paragraph={{ rows: 5 }} />
      </div>
    )
  }

  const verification = profileQuery.data?.onboarding || {}
  const verificationCase = profileQuery.data?.verification_case || {}
  const verificationInvalidated = isEmployerVerificationInvalidated(verificationCase)
  const authoritativeAccountVerification = profileQuery.data?.account_verification
    ?? profileQuery.data?.employer_account_level
  const level = getEmployerAccountVerificationLevel(
    verification,
    verificationCase,
    authoritativeAccountVerification,
  )
  const percent = level.percent
  const nextLevel = Math.min(level.level + 1, level.total)
  const verifiedJobQuotaUnlocked = Boolean(
    profileQuery.data?.posting_context?.verified_job_quota_eligible
    ?? profileQuery.data?.verified_job_quota_eligible
    ?? profileQuery.data?.account_verification?.verified_job_quota_eligible
    ?? (level.level === level.total && verification.dpa_accepted),
  )

  return (
    <div className="mb-5 rounded-sm border border-slate-200 bg-white p-5 sm:p-6">
      <EmployerVerificationLifecycleAlert
        className="mb-5"
        verificationCase={verificationCase}
      />
      <h2 className="text-base font-bold text-slate-800">
        {m.employer_account_level_title()} <span className="text-[var(--brand-primary)]">{m.employer_account_level_value({ level: level.level, total: level.total })}</span>
      </h2>

      {!verifiedJobQuotaUnlocked && (
        <div className="mt-4 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary-soft)] text-xl">🌟</span>
          <p className="text-sm leading-6 text-slate-600">
            {m.employer_account_level_free_before()}<strong className="text-slate-800">{m.employer_account_level_free_count()}</strong>.{' '}
            {level.level < level.total ? (
              <>
                {m.employer_account_level_next_before()}<strong className="text-slate-800">{m.employer_account_level_value({ level: nextLevel, total: level.total })}</strong>{m.employer_account_level_next_after()}{' '}
                <strong className="text-[var(--brand-primary)]">{m.employer_account_level_quota()}</strong>.
              </>
            ) : (
              <>
                {m.employer_account_level_auto_unlock()}{' '}
                <strong className="text-[var(--brand-primary)]">{m.employer_account_level_quota()}</strong>.
              </>
            )}
          </p>
        </div>
      )}
      {verifiedJobQuotaUnlocked && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
          {m.employer_account_level_unlocked_before()}<strong>{m.employer_account_level_unlocked_count()}</strong>.
        </p>
      )}

      <p className="mt-4 text-sm text-slate-500">{m.employer_account_level_steps_intro()}</p>

      <div className="mt-5 flex items-center justify-between text-sm">
        <strong className="text-base text-slate-800">{m.employer_account_checklist_title()}</strong>
        <span className="text-slate-500">{m.employer_account_level_progress()}<strong className="text-[var(--brand-primary)]">{percent}%</strong></span>
      </div>

      <div className="mt-4 divide-y divide-slate-100">
        {STEPS.map((step) => {
          const completed = Boolean(
            verification[step.key]
            && !(verificationInvalidated && step.key === 'business_doc_approved'),
          )
          return (
            <Link
              key={step.key}
              to={step.to}
              className="flex items-center gap-3 py-4 text-sm font-semibold !text-slate-800 transition hover:!text-[var(--brand-primary-hover)]"
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full ${completed ? 'text-[var(--brand-primary)]' : 'border border-slate-400 text-transparent'}`}>
                {completed && <CheckCircleFilled />}
              </span>
              <span className="min-w-0 flex-1">{step.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]"><ArrowRightOutlined /></span>
            </Link>
          )
        })}
      </div>

      <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
        <Link
          to={EMPLOYER_VERIFY_URL}
          className="rounded-md border border-[var(--brand-primary)] px-4 py-2 text-sm font-medium !text-[var(--brand-primary)] transition hover:bg-[var(--brand-primary-soft)]"
        >
          {m.employer_account_level_learn_more()}
        </Link>
      </div>
    </div>
  )
}

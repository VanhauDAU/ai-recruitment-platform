import { ArrowRightOutlined, CheckCircleFilled } from '@ant-design/icons'
import { Link } from 'react-router'
import {
  EMPLOYER_COMPANY_SETTINGS_URL,
  EMPLOYER_PHONE_VERIFY_URL,
  EMPLOYER_VERIFY_URL,
  employerAppPath,
} from '@/shared/config/portals'
import { m } from '@/shared/config/i18n'

const ACCOUNT_VERIFICATION_LEVEL_STEPS = [
  {
    key: 'phone_verified',
    label: m.employer_workspace_verification_step_phone(),
    to: EMPLOYER_PHONE_VERIFY_URL,
  },
  {
    key: 'company_linked',
    label: m.employer_workspace_verification_step_company(),
    to: `${EMPLOYER_COMPANY_SETTINGS_URL}?update=true`,
  },
  {
    key: 'business_doc_approved',
    label: m.employer_workspace_verification_step_business_doc(),
    to: employerAppPath('/cai-dat/giay-phep-kinh-doanh'),
  },
]

export default function EmployerAccountVerificationPopover({ verification, level }) {
  return (
    <div className="w-[min(330px,calc(100vw-48px))] p-1 sm:w-[344px]" aria-label={m.employer_workspace_verification_popover_label()}>
      <div className="flex items-center gap-2 text-base font-bold text-slate-800">
        <span>{m.employer_workspace_verification_level_label()}</span>
        <strong className="text-[var(--brand-primary)]">
          {m.employer_workspace_verification_level({ level: level.level, total: level.total })}
        </strong>
      </div>
      <span className="mt-4 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-xl">
        🌟
      </span>
      <p className="mt-4 text-sm text-slate-500">{m.employer_workspace_verification_instructions()}</p>
      <div className="mt-5 flex items-center justify-between text-sm">
        <strong className="text-base text-slate-800">{m.employer_workspace_verification_info()}</strong>
        <span className="text-slate-500">
          {m.employer_workspace_verification_completed()} <strong className="text-[var(--brand-primary)]">{level.percent}%</strong>
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <span
          className="block h-full rounded-full bg-[var(--brand-primary)] transition-all"
          style={{ width: `${level.percent}%` }}
        />
      </div>
      <div className="mt-3 divide-y divide-slate-100">
        {ACCOUNT_VERIFICATION_LEVEL_STEPS.map((step) => {
          const completed = Boolean(verification[step.key])
          return (
            <Link
              key={step.key}
              to={step.to}
              className="flex items-center gap-3 py-4 text-sm font-semibold text-slate-700 transition hover:text-[var(--brand-primary-hover)]"
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full ${completed ? 'text-[var(--brand-primary)]' : 'border border-slate-400 text-transparent'}`}
              >
                {completed && <CheckCircleFilled />}
              </span>
              <span className="min-w-0 flex-1">{step.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                <ArrowRightOutlined />
              </span>
            </Link>
          )
        })}
      </div>
      <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
        <Link
          to={EMPLOYER_VERIFY_URL}
          className="rounded-md border border-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-[var(--brand-primary)] transition hover:bg-[var(--brand-primary-soft)]"
        >
          {m.employer_workspace_learn_more()}
        </Link>
      </div>
    </div>
  )
}

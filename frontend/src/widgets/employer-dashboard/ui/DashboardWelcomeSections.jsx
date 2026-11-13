import {
  ArrowRightOutlined,
  CheckCircleFilled,
  InfoCircleOutlined,
  LockOutlined,
  RocketOutlined,
} from '@ant-design/icons'
import { Progress } from 'antd'
import { Link } from 'react-router'
import {
  EMPLOYER_CAPABILITIES,
  employerReadinessAction,
  employerReadinessBlockersFor,
} from '@/entities/employer-profile'
import { DEFAULT_SITE_SETTINGS, settingText, useSiteSettings } from '@/entities/site-settings'
import { getEmployerVerificationProgress } from '@/features/verify-employer-account'
import {
  EMPLOYER_BUSINESS_LICENSE_URL,
  EMPLOYER_COMPANY_SETTINGS_URL,
  EMPLOYER_DATA_PROTECTION_URL,
  EMPLOYER_PHONE_VERIFY_URL,
  EMPLOYER_VERIFY_URL,
  employerAppPath,
} from '@/shared/config/portals'

const VERIFICATION_STEPS = [
  { key: 'phone_verified', label: 'Xác thực số điện thoại', to: EMPLOYER_PHONE_VERIFY_URL },
  { key: 'company_linked', label: 'Cập nhật công ty', to: `${EMPLOYER_COMPANY_SETTINGS_URL}?update=true` },
  { key: 'business_doc_submitted', label: 'Nộp giấy tờ đại diện', to: EMPLOYER_BUSINESS_LICENSE_URL },
  { key: 'candidate_dpa_submitted', label: 'Nộp văn bản DLCN', to: EMPLOYER_DATA_PROTECTION_URL },
  { key: 'dpa_accepted', label: 'Đồng ý thỏa thuận DPA', to: EMPLOYER_DATA_PROTECTION_URL },
]

export function DashboardComplianceNotice({ readiness }) {
  if (!readiness || readiness.candidateDataAccess) return null
  const blocker = employerReadinessBlockersFor(
    readiness,
    EMPLOYER_CAPABILITIES.CANDIDATE_DATA,
  )[0]
  const action = employerReadinessAction(blocker?.action)

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-blue-200/70 bg-blue-50/80 px-4 py-4 sm:flex-row sm:items-center" aria-label="Thông báo quan trọng">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm"><InfoCircleOutlined /></span>
      <div className="min-w-0 flex-1">
        <strong className="text-sm text-slate-800">Dữ liệu ứng viên đang được bảo vệ</strong>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{blocker?.message || 'Hoàn tất xác minh để mở quyền truy cập dữ liệu ứng viên.'}</p>
      </div>
      <Link to={action.to} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-600 !bg-blue-600 px-4 text-xs font-bold !text-white shadow-sm transition hover:border-blue-700 hover:!bg-blue-700">
        {action.label} <ArrowRightOutlined />
      </Link>
    </section>
  )
}

export function DashboardVerificationJourney({
  verification = {},
  hasPassword,
  jobWorkspaceReady = false,
}) {
  const { settings } = useSiteSettings()
  const primaryColor = settingText(settings.brand_primary_color, DEFAULT_SITE_SETTINGS.brand_primary_color)
  const progress = getEmployerVerificationProgress(verification)
  const completedCount = VERIFICATION_STEPS.filter((step) => verification[step.key]).length
  const activeIndex = VERIFICATION_STEPS.findIndex((step) => !verification[step.key])

  return (
    <section className="rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_35px_-26px_rgba(15,23,42,.45)] sm:p-6" aria-labelledby="verification-journey-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-lg text-emerald-600"><LockOutlined /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="verification-journey-title" className="text-base font-black text-slate-900">Hoàn thiện workspace tuyển dụng</h2>
              {completedCount === VERIFICATION_STEPS.length && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Đã hoàn tất</span>}
            </div>
            <p className="mt-1 text-xs text-slate-500">{completedCount}/{VERIFICATION_STEPS.length} bước xác thực · Bảo vệ tài khoản và dữ liệu ứng viên</p>
          </div>
        </div>
        <div className="flex items-center gap-3 sm:min-w-52">
          <Progress percent={progress.percent} showInfo={false} strokeColor={primaryColor} railColor="#e2e8f0" className="!mb-0" />
          <strong className="w-10 text-right text-xs text-emerald-700">{progress.percent}%</strong>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5" aria-label="Các bước xác thực">
        {VERIFICATION_STEPS.map((step, index) => {
          const done = Boolean(verification[step.key])
          const target = step.key === 'phone_verified' && !hasPassword ? EMPLOYER_VERIFY_URL : step.to
          return (
            <a
              key={step.key}
              href={target}
              target="_blank"
              rel="noreferrer"
              className={`group flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-3 transition ${done ? 'border-emerald-100 bg-emerald-50/60' : index === activeIndex ? 'border-emerald-300 bg-white ring-2 ring-emerald-100' : 'border-slate-200 bg-slate-50/70 hover:border-emerald-200'}`}
            >
              {done
                ? <CheckCircleFilled className="shrink-0 text-emerald-500" />
                : <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${index === activeIndex ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{index + 1}</span>}
              <span className={`min-w-0 flex-1 text-[11px] font-bold leading-4 ${done ? 'text-emerald-800' : 'text-slate-600'}`}>{step.label}</span>
              <ArrowRightOutlined className="shrink-0 text-[10px] text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-500" />
            </a>
          )
        })}
      </div>

      <Link
        to={jobWorkspaceReady ? employerAppPath('/jobs/new') : EMPLOYER_VERIFY_URL}
        aria-label="Đăng tin tuyển dụng đầu tiên"
        className="mt-3 flex items-center gap-3 rounded-xl border border-dashed border-slate-300 !bg-slate-50/80 px-3 py-3 text-xs font-bold !text-slate-600 transition hover:border-emerald-300 hover:!bg-emerald-50 hover:!text-emerald-700"
      >
        <RocketOutlined className="text-emerald-600" />
        <span className="min-w-0 flex-1">Sẵn sàng tuyển dụng? Đăng tin đầu tiên để bắt đầu nhận hồ sơ.</span>
        <ArrowRightOutlined />
      </Link>
    </section>
  )
}

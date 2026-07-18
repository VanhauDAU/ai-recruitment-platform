import {
  ArrowRightOutlined,
  BarChartOutlined,
  CheckCircleFilled,
  FileSearchOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  LockOutlined,
  RobotOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { Button, Progress } from 'antd'
import { Link } from 'react-router-dom'
import { getEmployerVerificationProgress } from '@/features/verify-employer-account'
import {
  EMPLOYER_BUSINESS_LICENSE_URL,
  EMPLOYER_COMPANY_SETTINGS_URL,
  EMPLOYER_DATA_PROTECTION_URL,
  EMPLOYER_PHONE_VERIFY_URL,
  EMPLOYER_VERIFY_URL,
} from '@/shared/config/portals'

const VERIFICATION_STEPS = [
  { key: 'phone_verified', label: 'Xác thực số điện thoại', to: EMPLOYER_PHONE_VERIFY_URL },
  { key: 'company_linked', label: 'Cập nhật thông tin công ty', to: `${EMPLOYER_COMPANY_SETTINGS_URL}?update=true` },
  { key: 'business_doc_submitted', label: 'Cập nhật Giấy đăng ký doanh nghiệp', to: EMPLOYER_BUSINESS_LICENSE_URL },
  { key: 'candidate_dpa_submitted', label: 'Thỏa thuận DLCN với ứng viên', to: EMPLOYER_DATA_PROTECTION_URL },
  { key: 'dpa_accepted', label: 'Đồng ý Thỏa thuận DLCN với ProCV', to: EMPLOYER_DATA_PROTECTION_URL },
  { key: 'first_job_posted', label: 'Đăng tin tuyển dụng đầu tiên', disabled: true },
]

export function DashboardComplianceNotice({ verification = {} }) {
  if (verification.candidate_dpa_submitted && verification.dpa_accepted) return null
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-lg border-l-4 border-blue-500 bg-white px-4 py-3 shadow-sm" aria-label="Thông báo quan trọng">
      <InfoCircleOutlined className="text-lg text-blue-600" />
      <div className="min-w-0 flex-1">
        <strong className="text-sm text-blue-700">Thông báo quan trọng</strong>
        <p className="mt-0.5 text-xs leading-5 text-slate-500">Hoàn thiện văn bản và thỏa thuận xử lý dữ liệu cá nhân để đảm bảo hồ sơ ứng viên được tiếp nhận an toàn.</p>
      </div>
      <Link to={EMPLOYER_DATA_PROTECTION_URL} className="text-xs font-bold text-emerald-600 hover:text-emerald-700">Cập nhật ngay</Link>
    </section>
  )
}

export function DashboardPromotionGrid() {
  return (
    <section className="grid gap-3 md:grid-cols-2" aria-label="Thông tin nổi bật">
      <article className="relative min-h-40 overflow-hidden rounded-xl bg-[linear-gradient(125deg,#064e3b_0%,#047857_55%,#10b981_120%)] p-5 text-white shadow-sm sm:p-6">
        <span className="absolute -right-12 -top-16 h-52 w-52 rounded-full border-[28px] border-white/10" />
        <span className="absolute bottom-4 right-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 text-4xl backdrop-blur"><BarChartOutlined /></span>
        <div className="relative max-w-[70%]">
          <span className="rounded-full bg-amber-300 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-amber-950">Báo cáo tuyển dụng</span>
          <h2 className="mt-4 text-xl font-black leading-tight">Đọc dữ liệu, tuyển đúng người</h2>
          <p className="mt-2 text-xs leading-5 text-emerald-100">Theo dõi hiệu quả tuyển dụng từ dữ liệu thật trong workspace.</p>
        </div>
      </article>
      <article className="relative min-h-40 overflow-hidden rounded-xl bg-[linear-gradient(125deg,#102a43_0%,#0c4a3c_58%,#059669_130%)] p-5 text-white shadow-sm sm:p-6">
        <span className="absolute -bottom-14 -right-8 h-48 w-48 rounded-full bg-emerald-300/15 blur-sm" />
        <RobotOutlined className="absolute bottom-5 right-8 text-7xl text-emerald-200/60" />
        <div className="relative max-w-[72%]">
          <span className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-300">ProCV AI</span>
          <h2 className="mt-3 text-xl font-black leading-tight">Tăng hiệu suất tuyển dụng</h2>
          <p className="mt-2 text-xs leading-5 text-slate-200">Gợi ý ứng viên và tự động hóa quy trình đang được phát triển.</p>
          <span className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold text-emerald-100">Sắp mở</span>
        </div>
      </article>
    </section>
  )
}

export function DashboardVerificationJourney({ verification = {}, displayName, hasPassword }) {
  const progress = getEmployerVerificationProgress(verification)
  const activeIndex = VERIFICATION_STEPS.findIndex((step) => !verification[step.key])

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-labelledby="verification-journey-title">
      <div className="flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6">
        <Progress type="circle" percent={progress.percent} size={52} strokeWidth={8} strokeColor="#00b14f" />
        <div className="min-w-0 flex-1">
          <h2 id="verification-journey-title" className="text-base font-extrabold text-slate-800">Chào {displayName},</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Hoàn thiện các bước dưới đây để tăng bảo mật và mức độ tin cậy với ứng viên.</p>
        </div>
        <Link to={EMPLOYER_VERIFY_URL} className="inline-flex items-center gap-2 text-xs font-bold text-emerald-600 hover:text-emerald-700">{progress.percent === 100 ? 'Xem trạng thái' : 'Tiếp tục xác thực'} <ArrowRightOutlined /></Link>
      </div>

      <div className="overflow-x-auto border-t border-slate-100 px-3 py-3 sm:px-4">
        <div className="flex min-w-max gap-2">
          {VERIFICATION_STEPS.map((step, index) => {
            const done = Boolean(verification[step.key])
            const disabled = step.disabled && !done
            const target = step.key === 'phone_verified' && !hasPassword ? EMPLOYER_VERIFY_URL : step.to
            const stateClass = done
              ? 'border-emerald-200 bg-emerald-50/70 text-emerald-700'
              : index === activeIndex
                ? 'border-emerald-500 bg-white text-emerald-700 shadow-sm'
                : 'border-slate-200 bg-white text-slate-600'
            const content = (
              <>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${done ? 'text-emerald-600' : 'border border-slate-300 text-[9px] text-slate-400'}`}>
                  {done ? <CheckCircleFilled /> : disabled ? <LockOutlined /> : index + 1}
                </span>
                <span className="min-w-0 flex-1 text-left text-[11px] font-bold leading-4">{step.label}</span>
                {!done && !disabled && <ArrowRightOutlined className="shrink-0 text-emerald-500" />}
              </>
            )
            return target && !done && !disabled ? (
              <Link key={step.key} to={target} className={`flex w-48 items-center gap-2 rounded-lg border px-3 py-3 transition hover:border-emerald-400 hover:text-emerald-700 ${stateClass}`}>{content}</Link>
            ) : (
              <div key={step.key} aria-disabled={disabled || undefined} className={`flex w-48 items-center gap-2 rounded-lg border px-3 py-3 ${disabled ? 'cursor-not-allowed opacity-60' : ''} ${stateClass}`}>{content}</div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

const DISCOVERY_ITEMS = [
  { label: 'Đăng tin tuyển dụng', description: 'Tạo và quản lý tin tuyển dụng', icon: FileTextOutlined, tone: 'bg-emerald-50 text-emerald-600' },
  { label: 'Tìm kiếm CV', description: 'Tiếp cận hồ sơ ứng viên phù hợp', icon: SearchOutlined, tone: 'bg-blue-50 text-blue-600' },
  { label: 'Mua dịch vụ', description: 'Khám phá giải pháp tăng hiệu quả', icon: ShoppingCartOutlined, tone: 'bg-violet-50 text-violet-600' },
]

export function DashboardDiscovery() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="employer-discovery-title">
      <h2 id="employer-discovery-title" className="flex items-center gap-2 text-sm font-extrabold text-slate-800"><SafetyCertificateOutlined className="text-emerald-600" /> Khám phá ProCV dành cho nhà tuyển dụng</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {DISCOVERY_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <article key={item.label} className="flex min-h-28 items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl ${item.tone}`}><Icon /></span>
              <div className="min-w-0 flex-1"><h3 className="text-sm font-extrabold text-slate-800">{item.label}</h3><p className="mt-1 text-[11px] leading-4 text-slate-400">{item.description}</p><Button disabled size="small" className="!mt-3">Sắp mở</Button></div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export function RecommendedCandidatesPromo() {
  return (
    <section className="grid overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[minmax(280px,.9fr)_minmax(0,1.1fr)]" aria-labelledby="recommended-candidates-title">
      <div className="relative flex min-h-56 items-center justify-center overflow-hidden bg-[linear-gradient(145deg,#ecfdf5,#d1fae5)] p-6">
        <span className="absolute left-8 top-8 h-12 w-12 rounded-full bg-white/70" />
        <span className="absolute bottom-8 right-10 h-16 w-16 rounded-full border-[10px] border-white/60" />
        <div className="relative flex h-36 w-36 items-center justify-center rounded-full bg-[#153448] text-7xl text-emerald-300 shadow-xl"><RobotOutlined /></div>
      </div>
      <div className="p-5 sm:p-7">
        <div className="flex items-center gap-2"><FileSearchOutlined className="text-emerald-600" /><h2 id="recommended-candidates-title" className="text-base font-extrabold text-slate-800">CV đề xuất</h2></div>
        <p className="mt-4 text-sm font-bold text-slate-700">Kích hoạt CV đề xuất bởi ProCV AI để:</p>
        <ul className="mt-4 space-y-3 text-xs text-slate-500">
          {['Gợi ý ứng viên tiềm năng', 'Lọc sẵn các thông tin nổi bật', 'Tự động sắp xếp theo mức độ phù hợp'].map((item) => <li key={item} className="flex items-center gap-2"><CheckCircleFilled className="text-emerald-500" /> {item}</li>)}
        </ul>
        <Button disabled type="primary" className="!mt-5">Sắp mở trong workspace</Button>
      </div>
    </section>
  )
}
